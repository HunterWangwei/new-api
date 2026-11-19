package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ticket_setting"

	"github.com/gin-gonic/gin"
)

type ticketReplyRequest struct {
	Content  string `json:"content"`
	Internal bool   `json:"internal"`
}

func ticketIdParam(c *gin.Context) (int, bool) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return 0, false
	}
	return id, true
}

func ticketListResponse(c *gin.Context, filter model.TicketFilter) {
	pageInfo := common.GetPageQuery(c)
	tickets, total, err := model.GetTickets(filter, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(tickets)
	common.ApiSuccess(c, pageInfo)
}

func ticketDetailResponse(c *gin.Context, id int, ownerId int) {
	ticket, messages, err := model.GetTicketDetail(id, ownerId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"ticket": ticket, "messages": messages})
}

func GetTicketOptions(c *gin.Context) {
	common.ApiSuccess(c, gin.H{
		"categories":      ticket_setting.Categories(),
		"auto_close_days": ticket_setting.AutoCloseDays(),
	})
}

func CreateTicket(c *gin.Context) {
	var input model.TicketInput
	if err := c.ShouldBindJSON(&input); err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	ticket, err := model.CreateTicket(c.GetInt("id"), input, ticket_setting.Categories())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, ticket)
}

func GetUserTickets(c *gin.Context) {
	ticketListResponse(c, model.TicketFilter{UserId: c.GetInt("id"), Status: c.Query("status")})
}

func GetUserTicket(c *gin.Context) {
	id, ok := ticketIdParam(c)
	if !ok {
		return
	}
	ticketDetailResponse(c, id, c.GetInt("id"))
}

func ReplyUserTicket(c *gin.Context) {
	id, ok := ticketIdParam(c)
	var req ticketReplyRequest
	if !ok {
		return
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	if _, err := model.ReplyTicket(id, c.GetInt("id"), false, false, req.Content); err != nil {
		common.ApiError(c, err)
		return
	}
	ticketDetailResponse(c, id, c.GetInt("id"))
}

func CloseUserTicket(c *gin.Context) {
	id, ok := ticketIdParam(c)
	if !ok {
		return
	}
	ticket, err := model.CloseTicket(id, c.GetInt("id"), false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, ticket)
}

func GetAllTickets(c *gin.Context) {
	userId, _ := strconv.Atoi(c.Query("user_id"))
	ticketListResponse(c, model.TicketFilter{
		UserId:   max(userId, 0),
		Status:   c.Query("status"),
		Category: c.Query("category"),
	})
}

func GetTicketPendingCount(c *gin.Context) {
	count, err := model.CountPendingTickets()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"count": count})
}

func GetAdminTicket(c *gin.Context) {
	id, ok := ticketIdParam(c)
	if !ok {
		return
	}
	ticketDetailResponse(c, id, 0)
}

func ReplyAdminTicket(c *gin.Context) {
	id, ok := ticketIdParam(c)
	var req ticketReplyRequest
	if !ok {
		return
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	ticket, err := model.ReplyTicket(id, c.GetInt("id"), true, req.Internal, req.Content)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !req.Internal {
		service.NotifyTicketReply(ticket)
	}
	ticketDetailResponse(c, id, 0)
}

func CloseAdminTicket(c *gin.Context) {
	id, ok := ticketIdParam(c)
	if !ok {
		return
	}
	ticket, err := model.CloseTicket(id, c.GetInt("id"), true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, ticket)
}
