package model

import (
	"errors"
	"net/mail"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

// A user must pass a manual identity verification before applying for an
// invoice. The verified subject is the only invoice title the user can use, so
// an application cannot be issued to someone other than the verified person or
// company. Each user has one verification record; resubmitting it puts it back
// into review.

const (
	InvoiceSubjectPersonal = "personal"
	InvoiceSubjectCompany  = "company"
)

const (
	InvoiceVerificationPending  = "pending"
	InvoiceVerificationApproved = "approved"
	InvoiceVerificationRejected = "rejected"
)

const maxInvoiceSubjectNameLength = 100

// invoiceTaxNoPattern matches the unified social credit code (18 characters)
// and legacy taxpayer identification numbers (15, 17 or 20 characters).
var invoiceTaxNoPattern = regexp.MustCompile(`^[0-9A-Z]{15}$|^[0-9A-Z]{17,18}$|^[0-9A-Z]{20}$`)

var residentIdPattern = regexp.MustCompile(`^[0-9]{17}[0-9X]$`)

var (
	ErrInvoiceVerificationNotFound = common.NewMessage("Verification not found")
	ErrInvoiceVerificationRequired = common.NewMessage("Complete identity verification before applying for an invoice")
)

type InvoiceVerification struct {
	Id           int    `json:"id"`
	UserId       int    `json:"user_id" gorm:"uniqueIndex"`
	Type         string `json:"type" gorm:"type:varchar(20)"`
	Name         string `json:"name" gorm:"type:varchar(255)"`
	IdNumber     string `json:"id_number" gorm:"type:varchar(32)"`
	Email        string `json:"email" gorm:"type:varchar(255)"`
	Status       string `json:"status" gorm:"type:varchar(20);index"`
	RejectReason string `json:"reject_reason" gorm:"type:varchar(255)"`
	HandlerId    int    `json:"handler_id"`
	CreatedTime  int64  `json:"created_time"`
	UpdatedTime  int64  `json:"updated_time"`
	HandledTime  int64  `json:"handled_time"`
}

// InvoiceVerificationInput is what the user submits for review.
type InvoiceVerificationInput struct {
	Type     string `json:"type"`
	Name     string `json:"name"`
	IdNumber string `json:"id_number"`
	Email    string `json:"email"`
}

// isValidResidentId checks a mainland resident identity card number with the
// GB 11643-1999 check digit.
func isValidResidentId(id string) bool {
	if !residentIdPattern.MatchString(id) {
		return false
	}
	weights := [17]int{7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2}
	sum := 0
	for i, weight := range weights {
		sum += int(id[i]-'0') * weight
	}
	return id[17] == "10X98765432"[sum%11]
}

// Normalize trims and upper-cases the input, then validates it: a personal
// subject needs a resident identity card number, a company subject its
// taxpayer identification number.
func (input *InvoiceVerificationInput) Normalize() error {
	input.Type = strings.TrimSpace(input.Type)
	input.Name = strings.TrimSpace(input.Name)
	input.IdNumber = strings.ToUpper(strings.TrimSpace(input.IdNumber))
	input.Email = strings.TrimSpace(input.Email)

	if input.Type != InvoiceSubjectPersonal && input.Type != InvoiceSubjectCompany {
		return common.NewMessage("Invalid verification type")
	}
	if input.Name == "" || utf8.RuneCountInString(input.Name) > maxInvoiceSubjectNameLength {
		return common.NewMessage("Name must be 1 to {{max}} characters", map[string]any{"max": maxInvoiceSubjectNameLength})
	}
	if input.Type == InvoiceSubjectPersonal && !isValidResidentId(input.IdNumber) {
		return common.NewMessage("Invalid resident identity card number")
	}
	if input.Type == InvoiceSubjectCompany && !invoiceTaxNoPattern.MatchString(input.IdNumber) {
		return common.NewMessage("Invalid taxpayer identification number")
	}
	if input.Email != "" {
		if addr, err := mail.ParseAddress(input.Email); err != nil || addr.Address != input.Email || len(input.Email) > 255 {
			return common.NewMessage("Invalid email address")
		}
	}
	return nil
}

// GetInvoiceVerification returns the user's verification, or nil when the
// user has not submitted one.
func GetInvoiceVerification(userId int) (*InvoiceVerification, error) {
	verification := &InvoiceVerification{}
	err := DB.Where("user_id = ?", userId).First(verification).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return verification, nil
}

// SubmitInvoiceVerification creates the user's verification or replaces its
// details. Either way it goes back to pending review, so a changed subject
// cannot be invoiced before an administrator checks it again.
func SubmitInvoiceVerification(userId int, input InvoiceVerificationInput) (*InvoiceVerification, error) {
	if err := input.Normalize(); err != nil {
		return nil, err
	}
	verification := &InvoiceVerification{}
	err := DB.Transaction(func(tx *gorm.DB) error {
		now := common.GetTimestamp()
		err := lockForUpdate(tx).Where("user_id = ?", userId).First(verification).Error
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if errors.Is(err, gorm.ErrRecordNotFound) {
			verification.UserId = userId
			verification.CreatedTime = now
		}
		verification.Type = input.Type
		verification.Name = input.Name
		verification.IdNumber = input.IdNumber
		verification.Email = input.Email
		verification.Status = InvoiceVerificationPending
		verification.RejectReason = ""
		verification.HandlerId = 0
		verification.HandledTime = 0
		verification.UpdatedTime = now
		if verification.Id == 0 {
			// The unique index on user_id rejects a concurrent first submission.
			return tx.Create(verification).Error
		}
		return tx.Save(verification).Error
	})
	if err != nil {
		return nil, err
	}
	return verification, nil
}

// ReviewInvoiceVerification approves a pending verification, or rejects a
// pending or approved one; rejecting an approved one revokes it. Applications
// already submitted keep the subject they were submitted with.
func ReviewInvoiceVerification(id int, handlerId int, approve bool, reason string) (*InvoiceVerification, error) {
	reason = strings.TrimSpace(reason)
	if !approve && (reason == "" || utf8.RuneCountInString(reason) > maxInvoiceReasonLength) {
		return nil, common.NewMessage("Reject reason must be 1 to {{max}} characters", map[string]any{"max": maxInvoiceReasonLength})
	}
	verification := &InvoiceVerification{}
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := lockForUpdate(tx).Where("id = ?", id).First(verification).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrInvoiceVerificationNotFound
			}
			return err
		}
		allowed := verification.Status == InvoiceVerificationPending ||
			(!approve && verification.Status == InvoiceVerificationApproved)
		if !allowed {
			return common.NewMessage("Verification status does not allow this operation")
		}
		if approve {
			verification.Status = InvoiceVerificationApproved
			verification.RejectReason = ""
		} else {
			verification.Status = InvoiceVerificationRejected
			verification.RejectReason = reason
		}
		verification.HandlerId = handlerId
		verification.HandledTime = common.GetTimestamp()
		return tx.Save(verification).Error
	})
	if err != nil {
		return nil, err
	}
	return verification, nil
}

// GetInvoiceVerifications lists verifications for review, newest submission
// first. An empty status lists every status.
func GetInvoiceVerifications(status string, pageInfo *common.PageInfo) (verifications []*InvoiceVerification, total int64, err error) {
	query := DB.Model(&InvoiceVerification{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	query = query.Session(&gorm.Session{})
	if err = query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err = query.Order("updated_time desc, id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&verifications).Error
	return verifications, total, err
}
