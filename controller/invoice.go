package controller

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// The multipart request also carries invoice_no and the part headers, so its
// limit is 1 MB above the file limit.
const (
	maxInvoiceFileMB       = 10
	maxInvoiceFileBytes    = maxInvoiceFileMB << 20
	maxInvoiceRequestBytes = maxInvoiceFileBytes + 1<<20
)

// invoiceFileDir is where issued invoice PDFs are stored: INVOICE_DIR, else
// ./invoices under the working directory (/data in the Docker image).
func invoiceFileDir() (string, error) {
	dir, err := filepath.Abs(common.GetEnvOrDefaultString("INVOICE_DIR", "invoices"))
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return "", err
	}
	return dir, nil
}

// invoiceVerificationView is the user's own verification as shown to them. A
// resident identity card number is masked; the full number only goes to the
// administrators who review it.
type invoiceVerificationView struct {
	*model.InvoiceVerification
	IdNumber string `json:"id_number"`
}

func newInvoiceVerificationView(verification *model.InvoiceVerification) *invoiceVerificationView {
	if verification == nil {
		return nil
	}
	idNumber := verification.IdNumber
	if verification.Type == model.InvoiceSubjectPersonal && len(idNumber) > 8 {
		idNumber = idNumber[:4] + strings.Repeat("*", len(idNumber)-8) + idNumber[len(idNumber)-4:]
	}
	return &invoiceVerificationView{InvoiceVerification: verification, IdNumber: idNumber}
}

func invoiceVerificationResponse(c *gin.Context, verification *model.InvoiceVerification) {
	common.ApiSuccess(c, gin.H{"verification": newInvoiceVerificationView(verification)})
}

func GetInvoiceVerification(c *gin.Context) {
	verification, err := model.GetInvoiceVerification(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	invoiceVerificationResponse(c, verification)
}

func SubmitInvoiceVerification(c *gin.Context) {
	var input model.InvoiceVerificationInput
	if err := c.ShouldBindJSON(&input); err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	verification, err := model.SubmitInvoiceVerification(c.GetInt("id"), input)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	invoiceVerificationResponse(c, verification)
}

func GetInvoiceVerifications(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	verifications, total, err := model.GetInvoiceVerifications(c.Query("status"), pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(verifications)
	common.ApiSuccess(c, pageInfo)
}

func ApproveInvoiceVerification(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	verification, err := model.ReviewInvoiceVerification(id, c.GetInt("id"), true, "")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, verification)
}

func RejectInvoiceVerification(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	var req rejectInvoiceRequest
	if err != nil || id <= 0 || c.ShouldBindJSON(&req) != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	verification, err := model.ReviewInvoiceVerification(id, c.GetInt("id"), false, req.Reason)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, verification)
}

func GetInvoiceEligibleTopUps(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	topups, total, err := model.GetInvoiceEligibleTopUps(c.GetInt("id"), pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(topups)
	common.ApiSuccess(c, pageInfo)
}

type applyInvoiceRequest struct {
	TopUpIds []int  `json:"top_up_ids"`
	Remark   string `json:"remark"`
}

func ApplyInvoice(c *gin.Context) {
	var req applyInvoiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	invoice, err := model.CreateInvoiceApplication(c.GetInt("id"), req.TopUpIds, req.Remark)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, invoice)
}

func GetUserInvoices(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	invoices, total, err := model.GetInvoices(c.GetInt("id"), c.Query("status"), pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(invoices)
	common.ApiSuccess(c, pageInfo)
}

func GetAllInvoices(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	userId, _ := strconv.Atoi(c.Query("user_id"))
	if userId < 0 {
		userId = 0
	}
	invoices, total, err := model.GetInvoices(userId, c.Query("status"), pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(invoices)
	common.ApiSuccess(c, pageInfo)
}

// IssueInvoice takes a multipart form with invoice_no and the PDF as file. The
// PDF is stored under a random name before the status changes, and removed
// again if the change fails.
func IssueInvoice(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxInvoiceRequestBytes)
	fileHeader, err := c.FormFile("file")
	if err != nil {
		common.ApiErrorT(c, "Upload the invoice PDF, at most {{max}} MB", map[string]any{"max": maxInvoiceFileMB})
		return
	}
	if fileHeader.Size > maxInvoiceFileBytes {
		common.ApiErrorT(c, "Upload the invoice PDF, at most {{max}} MB", map[string]any{"max": maxInvoiceFileMB})
		return
	}
	file, err := fileHeader.Open()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	content, err := io.ReadAll(io.LimitReader(file, maxInvoiceFileBytes+1))
	_ = file.Close()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if len(content) > maxInvoiceFileBytes || !bytes.HasPrefix(content, []byte("%PDF-")) || http.DetectContentType(content) != "application/pdf" {
		common.ApiErrorT(c, "Upload the invoice PDF, at most {{max}} MB", map[string]any{"max": maxInvoiceFileMB})
		return
	}

	dir, err := invoiceFileDir()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	fileName := fmt.Sprintf("invoice-%d-%s.pdf", id, uuid.NewString())
	filePath := filepath.Join(dir, fileName)
	if err := os.WriteFile(filePath, content, 0o640); err != nil {
		common.ApiError(c, err)
		return
	}

	invoice, err := model.IssueInvoice(id, c.GetInt("id"), c.PostForm("invoice_no"), fileName)
	if err != nil {
		if removeErr := os.Remove(filePath); removeErr != nil {
			common.SysError(common.LogText("failed to remove invoice file %s: %s", fileName, removeErr.Error()))
		}
		common.ApiError(c, err)
		return
	}
	service.NotifyInvoiceResult(invoice)
	common.ApiSuccess(c, invoice)
}

type rejectInvoiceRequest struct {
	Reason string `json:"reason"`
}

func RejectInvoice(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	var req rejectInvoiceRequest
	if err != nil || id <= 0 || c.ShouldBindJSON(&req) != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	invoice, err := model.RejectInvoice(id, c.GetInt("id"), req.Reason)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	service.NotifyInvoiceResult(invoice)
	common.ApiSuccess(c, invoice)
}

func VoidInvoice(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	invoice, err := model.VoidInvoice(id, c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	service.NotifyInvoiceResult(invoice)
	common.ApiSuccess(c, invoice)
}

// DownloadInvoiceFile serves the PDF of an issued invoice to its owner, and
// the PDF of any issued or voided invoice to administrators.
func DownloadInvoiceFile(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	invoice, err := model.GetInvoiceById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	isAdmin := c.GetInt("role") >= common.RoleAdminUser
	allowed := isAdmin || (invoice.UserId == c.GetInt("id") && invoice.Status == model.InvoiceStatusIssued)
	if !allowed {
		// Same response as a missing invoice, so ids of other users stay hidden.
		common.ApiError(c, model.ErrInvoiceNotFound)
		return
	}
	if invoice.FileName == "" || invoice.FileName != filepath.Base(invoice.FileName) {
		common.ApiError(c, model.ErrInvoiceNotFound)
		return
	}
	dir, err := invoiceFileDir()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	filePath := filepath.Join(dir, invoice.FileName)
	if _, err := os.Stat(filePath); err != nil {
		common.ApiErrorT(c, "Invoice file is missing, contact the administrator")
		return
	}
	c.FileAttachment(filePath, fmt.Sprintf("invoice-%s.pdf", invoice.InvoiceNo))
}
