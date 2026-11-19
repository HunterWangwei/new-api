package service

import (
	"context"
	"html"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/ticket_setting"

	"github.com/bytedance/gopkg/util/gopool"
)

const (
	notifyTypeTicketReply   = "ticket_reply"
	ticketAutoCloseInterval = 10 * time.Minute
)

var ticketAutoCloseOnce sync.Once

// NotifyTicketReply tells the ticket owner that support replied, through the
// notification method the user chose. The message names the ticket but not
// the reply, so the conversation stays in the console. It runs in the
// background and only logs failures.
func NotifyTicketReply(ticket *model.Ticket) {
	userId := ticket.UserId
	ticketId := ticket.Id
	title := ticket.Title
	gopool.Go(func() {
		setting, err := model.GetUserSetting(userId, false)
		if err != nil {
			common.SysError(common.LogText("failed to load notification setting for ticket %d: %s", ticketId, err.Error()))
			return
		}
		email, err := model.GetUserEmail(userId)
		if err != nil {
			common.SysError(common.LogText("failed to load notification setting for ticket %d: %s", ticketId, err.Error()))
			return
		}
		lang := model.GetUserLanguage(userId)
		args := map[string]any{"SystemName": common.SystemName, "Id": ticketId, "Title": html.EscapeString(title)}
		subject := i18n.Translate(lang, i18n.MsgEmailTicketReplySubject, args)
		content := i18n.Translate(lang, i18n.MsgEmailTicketReplyBody, args)
		if err := NotifyUser(userId, email, setting, dto.NewNotify(notifyTypeTicketReply, subject, content, nil)); err != nil {
			common.SysError(common.LogText("failed to send ticket reply notification for ticket %d: %s", ticketId, err.Error()))
		}
	})
}

// StartTicketAutoCloseTask closes tickets left unanswered after a support
// reply, on the master node only.
func StartTicketAutoCloseTask() {
	ticketAutoCloseOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			ticker := time.NewTicker(ticketAutoCloseInterval)
			defer ticker.Stop()
			for {
				closed, err := model.AutoCloseRepliedTickets(ticket_setting.AutoCloseDays(), common.GetTimestamp())
				if err != nil {
					logger.LogWarn(context.Background(), common.LogText("ticket auto-close task failed: %v", err))
				} else if closed > 0 {
					logger.LogInfo(context.Background(), common.LogText("ticket auto-close task closed %d tickets", closed))
				}
				<-ticker.C
			}
		})
	})
}
