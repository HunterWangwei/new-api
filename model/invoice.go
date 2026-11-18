package model

import (
	"errors"
	"regexp"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// Invoices are issued manually by an administrator for successful CNY (epay)
// top-up orders. An order may belong to at most one active application: the
// unique index on invoice_items.top_up_id enforces that even under concurrent
// submissions, and rejecting or voiding an application deletes its items so
// the orders can be invoiced again.

const (
	InvoiceStatusPending  = "pending"
	InvoiceStatusIssued   = "issued"
	InvoiceStatusRejected = "rejected"
	InvoiceStatusVoided   = "voided"
)

// InvoiceEligibleWindowSeconds limits invoicing to orders completed within the
// last 12 months.
const InvoiceEligibleWindowSeconds int64 = 365 * 24 * 60 * 60

const (
	MaxInvoiceTopUpsPerApply = 100
	maxInvoiceRemarkLength   = 200
	maxInvoiceReasonLength   = 200
	maxInvoiceNoLength       = 64
)

var invoiceNoPattern = regexp.MustCompile(`^[0-9A-Za-z-]+$`)

var (
	ErrInvoiceNotFound      = common.NewMessage("Invoice not found")
	ErrInvoiceStatusInvalid = common.NewMessage("Invoice status does not allow this operation")
)

type Invoice struct {
	Id           int    `json:"id"`
	UserId       int    `json:"user_id" gorm:"index"`
	Status       string `json:"status" gorm:"type:varchar(20);index"`
	AmountCents  int64  `json:"amount_cents"`
	TitleType    string `json:"title_type" gorm:"type:varchar(20)"`
	TitleName    string `json:"title_name" gorm:"type:varchar(255)"`
	TaxNo        string `json:"tax_no" gorm:"type:varchar(32)"`
	Email        string `json:"email" gorm:"type:varchar(255)"`
	Remark       string `json:"remark" gorm:"type:varchar(255)"`
	InvoiceNo    string `json:"invoice_no" gorm:"type:varchar(64)"`
	FileName     string `json:"-" gorm:"type:varchar(128)"`
	RejectReason string `json:"reject_reason" gorm:"type:varchar(255)"`
	HandlerId    int    `json:"handler_id"`
	CreatedTime  int64  `json:"created_time"`
	HandledTime  int64  `json:"handled_time"`
	// TradeNos snapshots the order numbers at application time, so the history
	// stays readable after a rejection or void releases the items.
	TradeNos string `json:"trade_nos" gorm:"type:text"`
	HasFile  bool   `json:"has_file" gorm:"-"`
}

type InvoiceItem struct {
	Id          int   `json:"id"`
	InvoiceId   int   `json:"invoice_id" gorm:"index"`
	TopUpId     int   `json:"top_up_id" gorm:"uniqueIndex"`
	AmountCents int64 `json:"amount_cents"`
}

func invoiceAmountCents(money float64) int64 {
	return decimal.NewFromFloat(money).Mul(decimal.NewFromInt(100)).Round(0).IntPart()
}

// eligibleInvoiceTopUps scopes tx to the user's successful CNY top-ups that
// completed inside the invoicing window and are not part of an active
// application. Orders created before payment_provider existed have an empty
// provider; they are treated as epay unless the method names another provider.
func eligibleInvoiceTopUps(tx *gorm.DB, userId int) *gorm.DB {
	cutoff := common.GetTimestamp() - InvoiceEligibleWindowSeconds
	nonCNYMethods := []string{PaymentMethodStripe, PaymentMethodCreem, PaymentMethodWaffo, PaymentMethodWaffoPancake, PaymentMethodBalance}
	return tx.Model(&TopUp{}).
		Where("user_id = ? AND status = ? AND complete_time >= ? AND money > 0", userId, common.TopUpStatusSuccess, cutoff).
		Where("payment_provider = ? OR ((payment_provider = '' OR payment_provider IS NULL) AND payment_method NOT IN ?)", PaymentProviderEpay, nonCNYMethods).
		Where("id NOT IN (?)", tx.Session(&gorm.Session{NewDB: true}).Model(&InvoiceItem{}).Select("top_up_id"))
}

func GetInvoiceEligibleTopUps(userId int, pageInfo *common.PageInfo) (topups []*TopUp, total int64, err error) {
	if err = eligibleInvoiceTopUps(DB, userId).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err = eligibleInvoiceTopUps(DB, userId).Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&topups).Error
	return topups, total, err
}

// CreateInvoiceApplication re-checks every order inside the transaction and
// sums the amount server-side; the client only chooses which orders to include.
// The invoice is made out to the user's approved verification subject.
func CreateInvoiceApplication(userId int, topUpIds []int, remark string) (*Invoice, error) {
	remark = strings.TrimSpace(remark)
	if utf8.RuneCountInString(remark) > maxInvoiceRemarkLength {
		return nil, common.NewMessage("Remark must be at most {{max}} characters", map[string]any{"max": maxInvoiceRemarkLength})
	}
	if len(topUpIds) > MaxInvoiceTopUpsPerApply {
		return nil, common.NewMessage("At most {{max}} orders can be invoiced at once", map[string]any{"max": MaxInvoiceTopUpsPerApply})
	}
	ids := make([]int, 0, len(topUpIds))
	for _, id := range topUpIds {
		if id > 0 && !slices.Contains(ids, id) {
			ids = append(ids, id)
		}
	}
	if len(ids) == 0 {
		return nil, common.NewMessage("Select at least one order")
	}

	invoice := &Invoice{}
	err := DB.Transaction(func(tx *gorm.DB) error {
		verification := &InvoiceVerification{}
		err := tx.Where("user_id = ? AND status = ?", userId, InvoiceVerificationApproved).First(verification).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrInvoiceVerificationRequired
		}
		if err != nil {
			return err
		}

		var topups []*TopUp
		if err := eligibleInvoiceTopUps(tx, userId).Where("id IN ?", ids).Order("id asc").Find(&topups).Error; err != nil {
			return err
		}
		if len(topups) != len(ids) {
			return common.NewMessage("Some orders are not eligible for invoicing or are already invoiced")
		}

		var totalCents int64
		tradeNos := make([]string, 0, len(topups))
		for _, topup := range topups {
			totalCents += invoiceAmountCents(topup.Money)
			tradeNos = append(tradeNos, topup.TradeNo)
		}
		if totalCents <= 0 {
			return common.NewMessage("Invoice amount must be greater than 0")
		}

		*invoice = Invoice{
			UserId:      userId,
			Status:      InvoiceStatusPending,
			AmountCents: totalCents,
			TitleType:   verification.Type,
			TitleName:   verification.Name,
			TaxNo:       invoiceTitleTaxNo(verification),
			Email:       verification.Email,
			Remark:      remark,
			TradeNos:    strings.Join(tradeNos, ","),
			CreatedTime: common.GetTimestamp(),
		}
		if err := tx.Create(invoice).Error; err != nil {
			return err
		}
		items := make([]InvoiceItem, 0, len(topups))
		for _, topup := range topups {
			items = append(items, InvoiceItem{InvoiceId: invoice.Id, TopUpId: topup.Id, AmountCents: invoiceAmountCents(topup.Money)})
		}
		// The unique index on top_up_id rejects an order a concurrent
		// application claimed after the eligibility query above.
		if err := tx.Create(&items).Error; err != nil {
			return common.NewMessage("Some orders are not eligible for invoicing or are already invoiced")
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return invoice, nil
}

// invoiceTitleTaxNo is the taxpayer number printed on the invoice. A personal
// invoice carries none; the resident identity card number only proves who the
// subject is.
func invoiceTitleTaxNo(verification *InvoiceVerification) string {
	if verification.Type == InvoiceSubjectCompany {
		return verification.IdNumber
	}
	return ""
}

// lockInvoiceForTransition loads the invoice under a row lock and checks that
// it is in the status the transition starts from.
func lockInvoiceForTransition(tx *gorm.DB, id int, fromStatus string) (*Invoice, error) {
	invoice := &Invoice{}
	if err := lockForUpdate(tx).Where("id = ?", id).First(invoice).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrInvoiceNotFound
		}
		return nil, err
	}
	if invoice.Status != fromStatus {
		return nil, ErrInvoiceStatusInvalid
	}
	return invoice, nil
}

// IssueInvoice marks a pending application as issued. The caller has already
// stored the PDF as fileName and removes it if this returns an error.
func IssueInvoice(id int, handlerId int, invoiceNo string, fileName string) (*Invoice, error) {
	invoiceNo = strings.TrimSpace(invoiceNo)
	if invoiceNo == "" || len(invoiceNo) > maxInvoiceNoLength || !invoiceNoPattern.MatchString(invoiceNo) {
		return nil, common.NewMessage("Invalid invoice number")
	}
	var invoice *Invoice
	err := DB.Transaction(func(tx *gorm.DB) error {
		var err error
		invoice, err = lockInvoiceForTransition(tx, id, InvoiceStatusPending)
		if err != nil {
			return err
		}
		invoice.Status = InvoiceStatusIssued
		invoice.InvoiceNo = invoiceNo
		invoice.FileName = fileName
		invoice.HandlerId = handlerId
		invoice.HandledTime = common.GetTimestamp()
		return tx.Save(invoice).Error
	})
	return invoice, err
}

// RejectInvoice rejects a pending application and releases its orders.
func RejectInvoice(id int, handlerId int, reason string) (*Invoice, error) {
	reason = strings.TrimSpace(reason)
	if reason == "" || utf8.RuneCountInString(reason) > maxInvoiceReasonLength {
		return nil, common.NewMessage("Reject reason must be 1 to {{max}} characters", map[string]any{"max": maxInvoiceReasonLength})
	}
	var invoice *Invoice
	err := DB.Transaction(func(tx *gorm.DB) error {
		var err error
		invoice, err = lockInvoiceForTransition(tx, id, InvoiceStatusPending)
		if err != nil {
			return err
		}
		if err := tx.Where("invoice_id = ?", id).Delete(&InvoiceItem{}).Error; err != nil {
			return err
		}
		invoice.Status = InvoiceStatusRejected
		invoice.RejectReason = reason
		invoice.HandlerId = handlerId
		invoice.HandledTime = common.GetTimestamp()
		return tx.Save(invoice).Error
	})
	return invoice, err
}

// VoidInvoice marks an issued invoice as voided after the administrator has
// reversed it with the tax authority, and releases its orders. The PDF is kept
// as a record.
func VoidInvoice(id int, handlerId int) (*Invoice, error) {
	var invoice *Invoice
	err := DB.Transaction(func(tx *gorm.DB) error {
		var err error
		invoice, err = lockInvoiceForTransition(tx, id, InvoiceStatusIssued)
		if err != nil {
			return err
		}
		if err := tx.Where("invoice_id = ?", id).Delete(&InvoiceItem{}).Error; err != nil {
			return err
		}
		invoice.Status = InvoiceStatusVoided
		invoice.HandlerId = handlerId
		invoice.HandledTime = common.GetTimestamp()
		return tx.Save(invoice).Error
	})
	return invoice, err
}

func GetInvoiceById(id int) (*Invoice, error) {
	invoice := &Invoice{}
	if err := DB.Where("id = ?", id).First(invoice).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrInvoiceNotFound
		}
		return nil, err
	}
	invoice.HasFile = invoice.FileName != ""
	return invoice, nil
}

// GetInvoices lists applications newest first. userId 0 lists every user's
// applications; an empty status lists every status.
func GetInvoices(userId int, status string, pageInfo *common.PageInfo) (invoices []*Invoice, total int64, err error) {
	query := DB.Model(&Invoice{})
	if userId > 0 {
		query = query.Where("user_id = ?", userId)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	query = query.Session(&gorm.Session{})
	if err = query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err = query.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&invoices).Error; err != nil {
		return nil, 0, err
	}
	for _, invoice := range invoices {
		invoice.HasFile = invoice.FileName != ""
	}
	return invoices, total, nil
}
