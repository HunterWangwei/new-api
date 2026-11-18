package service

import (
	"fmt"
	"html"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"

	"github.com/shopspring/decimal"
)

// NotifyInvoiceResult mails the applicant after an administrator issues,
// rejects or voids an application. It goes to the address on the invoice
// title, else the account email, in the user's saved language. Delivery runs
// in the background and only logs failures, because the status change has
// already been committed.
func NotifyInvoiceResult(invoice *model.Invoice) {
	email := invoice.Email
	if email == "" {
		accountEmail, err := model.GetUserEmail(invoice.UserId)
		if err != nil {
			common.SysError(common.LogText("failed to load email for invoice %d: %s", invoice.Id, err.Error()))
			return
		}
		email = accountEmail
	}
	if email == "" {
		return
	}
	lang := model.GetUserLanguage(invoice.UserId)

	args := map[string]any{
		"SystemName": common.SystemName,
		"Id":         invoice.Id,
		"Amount":     decimal.New(invoice.AmountCents, -2).StringFixed(2),
		"InvoiceNo":  html.EscapeString(invoice.InvoiceNo),
		"Reason":     html.EscapeString(invoice.RejectReason),
	}
	var subjectKey, bodyKey string
	switch invoice.Status {
	case model.InvoiceStatusIssued:
		subjectKey, bodyKey = i18n.MsgEmailInvoiceIssuedSubject, i18n.MsgEmailInvoiceIssuedBody
	case model.InvoiceStatusRejected:
		subjectKey, bodyKey = i18n.MsgEmailInvoiceRejectedSubject, i18n.MsgEmailInvoiceRejectedBody
	case model.InvoiceStatusVoided:
		subjectKey, bodyKey = i18n.MsgEmailInvoiceVoidedSubject, i18n.MsgEmailInvoiceVoidedBody
	default:
		return
	}
	subject := i18n.Translate(lang, subjectKey, args)
	content := fmt.Sprintf("<p>%s</p>", i18n.Translate(lang, bodyKey, args))
	invoiceId := invoice.Id
	go func() {
		if err := common.SendEmail(subject, email, content); err != nil {
			common.SysError(common.LogText("failed to send invoice notification for invoice %d: %s", invoiceId, err.Error()))
		}
	}()
}
