package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func insertTopUpForInvoiceTest(t *testing.T, tradeNo string, userId int, provider string, method string, status string, completeTime int64, money float64) *TopUp {
	t.Helper()
	topUp := &TopUp{
		UserId:          userId,
		Amount:          1,
		Money:           money,
		TradeNo:         tradeNo,
		PaymentMethod:   method,
		PaymentProvider: provider,
		Status:          status,
		CreateTime:      completeTime,
		CompleteTime:    completeTime,
	}
	require.NoError(t, topUp.Insert())
	return topUp
}

func insertApprovedVerificationForTest(t *testing.T, userId int) *InvoiceVerification {
	t.Helper()
	verification, err := SubmitInvoiceVerification(userId, InvoiceVerificationInput{
		Type:     InvoiceSubjectCompany,
		Name:     "测试科技有限公司",
		IdNumber: "91110000ma01abcd2x",
	})
	require.NoError(t, err)
	verification, err = ReviewInvoiceVerification(verification.Id, 99, true, "")
	require.NoError(t, err)
	return verification
}

func TestInvoiceApplicationOnlyAcceptsEligibleOrders(t *testing.T) {
	truncateTables(t)
	now := common.GetTimestamp()
	verification := insertApprovedVerificationForTest(t, 1)

	alipay := insertTopUpForInvoiceTest(t, "inv-alipay", 1, PaymentProviderEpay, "alipay", common.TopUpStatusSuccess, now, 10.1)
	legacy := insertTopUpForInvoiceTest(t, "inv-legacy", 1, "", "wxpay", common.TopUpStatusSuccess, now, 20.2)
	ineligible := map[string]*TopUp{
		"stripe":      insertTopUpForInvoiceTest(t, "inv-stripe", 1, PaymentProviderStripe, PaymentMethodStripe, common.TopUpStatusSuccess, now, 5),
		"legacy card": insertTopUpForInvoiceTest(t, "inv-legacy-stripe", 1, "", PaymentMethodStripe, common.TopUpStatusSuccess, now, 5),
		"pending":     insertTopUpForInvoiceTest(t, "inv-pending", 1, PaymentProviderEpay, "alipay", common.TopUpStatusPending, now, 5),
		"expired":     insertTopUpForInvoiceTest(t, "inv-old", 1, PaymentProviderEpay, "alipay", common.TopUpStatusSuccess, now-InvoiceEligibleWindowSeconds-60, 5),
		"other user":  insertTopUpForInvoiceTest(t, "inv-other", 2, PaymentProviderEpay, "alipay", common.TopUpStatusSuccess, now, 5),
	}

	eligible, total, err := GetInvoiceEligibleTopUps(1, &common.PageInfo{Page: 1, PageSize: 20})
	require.NoError(t, err)
	assert.EqualValues(t, 2, total)
	require.Len(t, eligible, 2)
	assert.ElementsMatch(t, []int{alipay.Id, legacy.Id}, []int{eligible[0].Id, eligible[1].Id})

	for name, topUp := range ineligible {
		_, err := CreateInvoiceApplication(1, []int{alipay.Id, topUp.Id}, "")
		assert.Error(t, err, name)
	}

	invoice, err := CreateInvoiceApplication(1, []int{alipay.Id, legacy.Id, alipay.Id}, " 季度报销 ")
	require.NoError(t, err)
	assert.Equal(t, InvoiceStatusPending, invoice.Status)
	assert.EqualValues(t, 3030, invoice.AmountCents)
	assert.Equal(t, "季度报销", invoice.Remark)
	assert.Equal(t, verification.Name, invoice.TitleName)
	assert.Equal(t, InvoiceSubjectCompany, invoice.TitleType)
	assert.Equal(t, "91110000MA01ABCD2X", invoice.TaxNo)
	assert.Equal(t, "inv-alipay,inv-legacy", invoice.TradeNos)

	_, total, err = GetInvoiceEligibleTopUps(1, &common.PageInfo{Page: 1, PageSize: 20})
	require.NoError(t, err)
	assert.EqualValues(t, 0, total)
}

func TestInvoiceApplicationRequiresApprovedVerification(t *testing.T) {
	truncateTables(t)
	now := common.GetTimestamp()
	topUp := insertTopUpForInvoiceTest(t, "inv-gate", 1, PaymentProviderEpay, "alipay", common.TopUpStatusSuccess, now, 10)
	insertApprovedVerificationForTest(t, 2)

	_, err := CreateInvoiceApplication(1, []int{topUp.Id}, "")
	assert.ErrorIs(t, err, ErrInvoiceVerificationRequired, "another user's approval does not count")

	pending, err := SubmitInvoiceVerification(1, InvoiceVerificationInput{Type: InvoiceSubjectPersonal, Name: "张三", IdNumber: "11010519491231002x"})
	require.NoError(t, err)
	assert.Equal(t, "11010519491231002X", pending.IdNumber)
	_, err = CreateInvoiceApplication(1, []int{topUp.Id}, "")
	assert.ErrorIs(t, err, ErrInvoiceVerificationRequired, "a pending verification does not allow applying")

	_, err = ReviewInvoiceVerification(pending.Id, 99, true, "")
	require.NoError(t, err)
	invoice, err := CreateInvoiceApplication(1, []int{topUp.Id}, "")
	require.NoError(t, err)
	assert.Equal(t, "张三", invoice.TitleName)
	assert.Empty(t, invoice.TaxNo, "a personal invoice carries no taxpayer number")

	resubmitted, err := SubmitInvoiceVerification(1, InvoiceVerificationInput{Type: InvoiceSubjectPersonal, Name: "李四", IdNumber: "440304200001011239"})
	require.NoError(t, err)
	assert.Equal(t, pending.Id, resubmitted.Id, "each user keeps one verification record")
	assert.Equal(t, InvoiceVerificationPending, resubmitted.Status, "changed details go back to review")
	_, err = RejectInvoice(invoice.Id, 99, "重新认证")
	require.NoError(t, err)
	_, err = CreateInvoiceApplication(1, []int{topUp.Id}, "")
	assert.ErrorIs(t, err, ErrInvoiceVerificationRequired)
}

func TestInvoiceOrderIsReleasedOnlyByRejectOrVoid(t *testing.T) {
	truncateTables(t)
	now := common.GetTimestamp()
	insertApprovedVerificationForTest(t, 1)
	topUp := insertTopUpForInvoiceTest(t, "inv-cycle", 1, PaymentProviderEpay, "alipay", common.TopUpStatusSuccess, now, 99.99)

	first, err := CreateInvoiceApplication(1, []int{topUp.Id}, "")
	require.NoError(t, err)
	_, err = CreateInvoiceApplication(1, []int{topUp.Id}, "")
	require.Error(t, err, "a pending application keeps the order")
	duplicate := InvoiceItem{InvoiceId: first.Id + 1, TopUpId: topUp.Id, AmountCents: 1}
	require.Error(t, DB.Create(&duplicate).Error, "the unique index rejects a second active item")

	rejected, err := RejectInvoice(first.Id, 99, "抬头有误")
	require.NoError(t, err)
	assert.Equal(t, InvoiceStatusRejected, rejected.Status)
	assert.Equal(t, "抬头有误", rejected.RejectReason)

	second, err := CreateInvoiceApplication(1, []int{topUp.Id}, "")
	require.NoError(t, err)
	issued, err := IssueInvoice(second.Id, 99, "25110000000012345678", "invoice-test.pdf")
	require.NoError(t, err)
	assert.Equal(t, InvoiceStatusIssued, issued.Status)
	_, err = CreateInvoiceApplication(1, []int{topUp.Id}, "")
	require.Error(t, err, "an issued invoice keeps the order")

	voided, err := VoidInvoice(second.Id, 99)
	require.NoError(t, err)
	assert.Equal(t, InvoiceStatusVoided, voided.Status)
	assert.Equal(t, "invoice-test.pdf", voided.FileName)
	_, err = CreateInvoiceApplication(1, []int{topUp.Id}, "")
	require.NoError(t, err)
}

func TestInvoiceStatusTransitions(t *testing.T) {
	truncateTables(t)
	now := common.GetTimestamp()
	insertApprovedVerificationForTest(t, 1)
	topUp := insertTopUpForInvoiceTest(t, "inv-transition", 1, PaymentProviderEpay, "alipay", common.TopUpStatusSuccess, now, 10)
	invoice, err := CreateInvoiceApplication(1, []int{topUp.Id}, "")
	require.NoError(t, err)

	_, err = VoidInvoice(invoice.Id, 99)
	assert.ErrorIs(t, err, ErrInvoiceStatusInvalid, "only issued invoices can be voided")
	_, err = IssueInvoice(invoice.Id, 99, "../etc", "invoice-test.pdf")
	assert.Error(t, err, "invoice numbers are restricted to letters, digits and dashes")
	_, err = RejectInvoice(invoice.Id, 99, "  ")
	assert.Error(t, err, "a reject reason is required")

	_, err = RejectInvoice(invoice.Id, 99, "重复申请")
	require.NoError(t, err)
	_, err = IssueInvoice(invoice.Id, 99, "25110000000012345678", "invoice-test.pdf")
	assert.ErrorIs(t, err, ErrInvoiceStatusInvalid, "a rejected application cannot be issued")
	_, err = RejectInvoice(999999, 99, "不存在")
	assert.ErrorIs(t, err, ErrInvoiceNotFound)
}

func TestInvoiceVerificationValidation(t *testing.T) {
	cases := []struct {
		name  string
		input InvoiceVerificationInput
		valid bool
	}{
		{"personal with valid identity card", InvoiceVerificationInput{Type: InvoiceSubjectPersonal, Name: "张三", IdNumber: "11010519491231002x"}, true},
		{"personal with wrong check digit", InvoiceVerificationInput{Type: InvoiceSubjectPersonal, Name: "张三", IdNumber: "110105194912310021"}, false},
		{"personal with 15-digit number", InvoiceVerificationInput{Type: InvoiceSubjectPersonal, Name: "张三", IdNumber: "110105491231002"}, false},
		{"company with credit code", InvoiceVerificationInput{Type: InvoiceSubjectCompany, Name: "公司", IdNumber: "91110000MA01ABCD2X"}, true},
		{"company without tax number", InvoiceVerificationInput{Type: InvoiceSubjectCompany, Name: "公司"}, false},
		{"company with malformed tax number", InvoiceVerificationInput{Type: InvoiceSubjectCompany, Name: "公司", IdNumber: "9111-0000"}, false},
		{"unknown type", InvoiceVerificationInput{Type: "vat_special", Name: "公司", IdNumber: "91110000MA01ABCD2X"}, false},
		{"blank name", InvoiceVerificationInput{Type: InvoiceSubjectCompany, Name: "  ", IdNumber: "91110000MA01ABCD2X"}, false},
		{"display-name email", InvoiceVerificationInput{Type: InvoiceSubjectCompany, Name: "公司", IdNumber: "91110000MA01ABCD2X", Email: "A <a@example.com>"}, false},
	}
	for _, tc := range cases {
		input := tc.input
		err := input.Normalize()
		if tc.valid {
			assert.NoError(t, err, tc.name)
		} else {
			assert.Error(t, err, tc.name)
		}
	}
}

func TestInvoiceVerificationReviewTransitions(t *testing.T) {
	truncateTables(t)
	verification, err := SubmitInvoiceVerification(1, InvoiceVerificationInput{Type: InvoiceSubjectCompany, Name: "公司", IdNumber: "91110000MA01ABCD2X"})
	require.NoError(t, err)

	_, err = ReviewInvoiceVerification(verification.Id, 99, false, " ")
	assert.Error(t, err, "a reject reason is required")
	rejected, err := ReviewInvoiceVerification(verification.Id, 99, false, "名称与营业执照不符")
	require.NoError(t, err)
	assert.Equal(t, InvoiceVerificationRejected, rejected.Status)
	_, err = ReviewInvoiceVerification(verification.Id, 99, true, "")
	assert.Error(t, err, "a rejected verification must be resubmitted before approval")

	resubmitted, err := SubmitInvoiceVerification(1, InvoiceVerificationInput{Type: InvoiceSubjectCompany, Name: "公司", IdNumber: "91110000MA01ABCD2X"})
	require.NoError(t, err)
	assert.Empty(t, resubmitted.RejectReason)
	approved, err := ReviewInvoiceVerification(verification.Id, 99, true, "")
	require.NoError(t, err)
	assert.Equal(t, InvoiceVerificationApproved, approved.Status)
	revoked, err := ReviewInvoiceVerification(verification.Id, 99, false, "资质失效")
	require.NoError(t, err, "an approved verification can be revoked")
	assert.Equal(t, InvoiceVerificationRejected, revoked.Status)

	_, err = ReviewInvoiceVerification(999999, 99, true, "")
	assert.ErrorIs(t, err, ErrInvoiceVerificationNotFound)
	missing, err := GetInvoiceVerification(2)
	require.NoError(t, err)
	assert.Nil(t, missing)
}
