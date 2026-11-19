package model

import (
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/ticket_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var ticketTestCategories = []string{"API issues", "Other"}

func insertUserForTicketTest(t *testing.T, id int) {
	t.Helper()
	require.NoError(t, DB.Create(&User{
		Id:       id,
		Username: fmt.Sprintf("ticket_user_%d", id),
		AffCode:  fmt.Sprintf("ticket_aff_%d", id),
		Status:   common.UserStatusEnabled,
	}).Error)
}

func openTicketForTest(t *testing.T, userId int) *Ticket {
	t.Helper()
	ticket, err := CreateTicket(userId, TicketInput{Category: "API issues", Title: "调用报错", Content: "返回 500"}, ticketTestCategories)
	require.NoError(t, err)
	return ticket
}

func TestCreateTicketValidatesInputAndOpenLimit(t *testing.T) {
	truncateTables(t)
	insertUserForTicketTest(t, 1)

	invalid := map[string]TicketInput{
		"unknown category": {Category: "Billing", Title: "t", Content: "c"},
		"blank title":      {Category: "Other", Title: "  ", Content: "c"},
		"blank content":    {Category: "Other", Title: "t", Content: " \n "},
	}
	for name, input := range invalid {
		_, err := CreateTicket(1, input, ticketTestCategories)
		assert.Error(t, err, name)
	}

	ticket, err := CreateTicket(1, TicketInput{Category: "API issues", Title: " 调用报错 ", Reference: " req-1 ", Content: " 返回 500 "}, ticketTestCategories)
	require.NoError(t, err)
	assert.Equal(t, TicketStatusPending, ticket.Status)
	assert.Equal(t, "调用报错", ticket.Title)
	assert.Equal(t, "req-1", ticket.Reference)
	_, messages, err := GetTicketDetail(ticket.Id, 1)
	require.NoError(t, err)
	require.Len(t, messages, 1)
	assert.Equal(t, "返回 500", messages[0].Content)

	for range MaxOpenTicketsPerUser - 1 {
		openTicketForTest(t, 1)
	}
	_, err = CreateTicket(1, TicketInput{Category: "Other", Title: "t", Content: "c"}, ticketTestCategories)
	assert.Error(t, err, "a user cannot exceed the open-ticket limit")

	_, err = CloseTicket(ticket.Id, 1, false)
	require.NoError(t, err)
	openTicketForTest(t, 1)
}

func TestTicketRepliesMoveStatusAndHideInternalNotes(t *testing.T) {
	truncateTables(t)
	insertUserForTicketTest(t, 1)
	insertUserForTicketTest(t, 2)
	ticket := openTicketForTest(t, 1)

	_, err := ReplyTicket(ticket.Id, 2, false, false, "我也想看")
	assert.ErrorIs(t, err, ErrTicketNotFound, "another user cannot reply")
	_, _, err = GetTicketDetail(ticket.Id, 2)
	assert.ErrorIs(t, err, ErrTicketNotFound, "another user cannot read")

	noted, err := ReplyTicket(ticket.Id, 99, true, true, "疑似上游故障")
	require.NoError(t, err)
	assert.Equal(t, TicketStatusPending, noted.Status, "an internal note does not hand the ticket to the user")
	assert.Zero(t, noted.LastAdminReplyTime)

	replied, err := ReplyTicket(ticket.Id, 99, true, false, "已修复，请重试")
	require.NoError(t, err)
	assert.Equal(t, TicketStatusReplied, replied.Status)
	assert.NotZero(t, replied.LastAdminReplyTime)

	_, err = ReplyTicket(ticket.Id, 1, false, true, "用户不能写内部备注")
	require.NoError(t, err)
	_, userView, err := GetTicketDetail(ticket.Id, 1)
	require.NoError(t, err)
	_, adminView, err := GetTicketDetail(ticket.Id, 0)
	require.NoError(t, err)
	assert.Len(t, adminView, 4)
	require.Len(t, userView, 3, "the internal note is hidden from the user")
	assert.False(t, userView[2].Internal, "a user reply is never stored as an internal note")
	again, _, err := GetTicketDetail(ticket.Id, 1)
	require.NoError(t, err)
	assert.Equal(t, TicketStatusPending, again.Status, "a user reply hands the ticket back to support")
}

func TestTicketCloseReopenAndAutoClose(t *testing.T) {
	truncateTables(t)
	insertUserForTicketTest(t, 1)
	ticket := openTicketForTest(t, 1)

	closed, err := CloseTicket(ticket.Id, 1, false)
	require.NoError(t, err)
	assert.Equal(t, TicketStatusClosed, closed.Status)
	assert.Equal(t, TicketClosedByUser, closed.ClosedBy)
	reopened, err := ReplyTicket(ticket.Id, 1, false, false, "问题又出现了")
	require.NoError(t, err)
	assert.Equal(t, TicketStatusPending, reopened.Status, "a reply within the window reopens the ticket")
	assert.Empty(t, reopened.ClosedBy)

	_, err = CloseTicket(ticket.Id, 99, true)
	require.NoError(t, err)
	require.NoError(t, DB.Model(&Ticket{}).Where("id = ?", ticket.Id).Update("closed_time", common.GetTimestamp()-TicketReopenWindowSeconds-60).Error)
	_, err = ReplyTicket(ticket.Id, 1, false, false, "还在吗")
	assert.Error(t, err, "a ticket closed beyond the window cannot be reopened")

	now := common.GetTimestamp()
	stale := openTicketForTest(t, 1)
	_, err = ReplyTicket(stale.Id, 99, true, false, "请提供请求 ID")
	require.NoError(t, err)
	require.NoError(t, DB.Model(&Ticket{}).Where("id = ?", stale.Id).Update("last_admin_reply_time", now-8*24*60*60).Error)
	fresh := openTicketForTest(t, 1)
	_, err = ReplyTicket(fresh.Id, 99, true, false, "处理中")
	require.NoError(t, err)
	waiting := openTicketForTest(t, 1)

	count, err := AutoCloseRepliedTickets(0, now)
	require.NoError(t, err)
	assert.Zero(t, count, "0 days turns automatic closing off")
	count, err = AutoCloseRepliedTickets(7, now)
	require.NoError(t, err)
	assert.EqualValues(t, 1, count)
	for id, want := range map[int]string{stale.Id: TicketStatusClosed, fresh.Id: TicketStatusReplied, waiting.Id: TicketStatusPending} {
		got, _, err := GetTicketDetail(id, 0)
		require.NoError(t, err)
		assert.Equal(t, want, got.Status, id)
	}
	autoClosed, _, err := GetTicketDetail(stale.Id, 0)
	require.NoError(t, err)
	assert.Equal(t, TicketClosedByAuto, autoClosed.ClosedBy)
}

func TestTicketListsPutPendingFirstForAdmins(t *testing.T) {
	truncateTables(t)
	insertUserForTicketTest(t, 1)
	insertUserForTicketTest(t, 2)
	waiting := openTicketForTest(t, 1)
	replied := openTicketForTest(t, 2)
	_, err := ReplyTicket(replied.Id, 99, true, false, "已回复")
	require.NoError(t, err)

	all, total, err := GetTickets(TicketFilter{}, &common.PageInfo{Page: 1, PageSize: 10})
	require.NoError(t, err)
	assert.EqualValues(t, 2, total)
	require.Len(t, all, 2)
	assert.Equal(t, waiting.Id, all[0].Id, "tickets waiting for support come first")

	own, total, err := GetTickets(TicketFilter{UserId: 2}, &common.PageInfo{Page: 1, PageSize: 10})
	require.NoError(t, err)
	assert.EqualValues(t, 1, total)
	require.Len(t, own, 1)
	assert.Equal(t, replied.Id, own[0].Id)

	pending, err := CountPendingTickets()
	require.NoError(t, err)
	assert.EqualValues(t, 1, pending)
}

func TestTicketSettingValidation(t *testing.T) {
	cases := []struct {
		key   string
		value string
		valid bool
	}{
		{ticket_setting.CategoriesOptionKey, `["API issues","发票"]`, true},
		{ticket_setting.CategoriesOptionKey, `[]`, false},
		{ticket_setting.CategoriesOptionKey, `["发票","发票"]`, false},
		{ticket_setting.CategoriesOptionKey, `[" 发票"]`, false},
		{ticket_setting.CategoriesOptionKey, `[""]`, false},
		{ticket_setting.CategoriesOptionKey, `"发票"`, false},
		{ticket_setting.AutoCloseDaysOptionKey, "0", true},
		{ticket_setting.AutoCloseDaysOptionKey, "90", true},
		{ticket_setting.AutoCloseDaysOptionKey, "91", false},
		{ticket_setting.AutoCloseDaysOptionKey, "-1", false},
		{ticket_setting.AutoCloseDaysOptionKey, "7.5", false},
	}
	for _, tc := range cases {
		err := validateOptionValue(tc.key, tc.value)
		if tc.valid {
			assert.NoError(t, err, "%s=%s", tc.key, tc.value)
		} else {
			assert.Error(t, err, "%s=%s", tc.key, tc.value)
		}
	}
}
