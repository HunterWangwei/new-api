package model

import (
	"errors"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// A ticket is a text conversation between a user and customer service. It is
// pending while support owes a reply, replied while the user does, and closed
// by either side or automatically when the user does not answer a reply.

const (
	TicketStatusPending = "pending"
	TicketStatusReplied = "replied"
	TicketStatusClosed  = "closed"
)

const (
	TicketClosedByUser  = "user"
	TicketClosedByAdmin = "admin"
	TicketClosedByAuto  = "auto"
)

const (
	MaxOpenTicketsPerUser    = 5
	maxTicketTitleLength     = 100
	maxTicketContentLength   = 5000
	maxTicketReferenceLength = 128
	// TicketReopenWindowSeconds is how long after closing the user can reopen
	// a ticket by replying; later questions need a new ticket.
	TicketReopenWindowSeconds int64 = 7 * 24 * 60 * 60
)

var (
	ErrTicketNotFound = common.NewMessage("Ticket not found")
	errTicketReopen   = common.NewMessage("This ticket was closed more than 7 days ago. Open a new ticket instead.")
)

type Ticket struct {
	Id                 int    `json:"id"`
	UserId             int    `json:"user_id" gorm:"index"`
	Category           string `json:"category" gorm:"type:varchar(64)"`
	Title              string `json:"title" gorm:"type:varchar(255)"`
	Reference          string `json:"reference" gorm:"type:varchar(128)"`
	Status             string `json:"status" gorm:"type:varchar(20);index"`
	CreatedTime        int64  `json:"created_time"`
	UpdatedTime        int64  `json:"updated_time" gorm:"index"`
	LastUserReplyTime  int64  `json:"last_user_reply_time"`
	LastAdminReplyTime int64  `json:"last_admin_reply_time"`
	ClosedTime         int64  `json:"closed_time"`
	ClosedBy           string `json:"closed_by" gorm:"type:varchar(20)"`
}

type TicketMessage struct {
	Id       int  `json:"id"`
	TicketId int  `json:"ticket_id" gorm:"index"`
	AuthorId int  `json:"author_id"`
	IsAdmin  bool `json:"is_admin"`
	// Internal notes are visible to administrators only.
	Internal    bool   `json:"internal"`
	Content     string `json:"content" gorm:"type:text"`
	CreatedTime int64  `json:"created_time"`
}

// TicketInput is what a user submits to open a ticket.
type TicketInput struct {
	Category  string `json:"category"`
	Title     string `json:"title"`
	Reference string `json:"reference"`
	Content   string `json:"content"`
}

func normalizeTicketContent(content string) (string, error) {
	content = strings.TrimSpace(content)
	if content == "" || utf8.RuneCountInString(content) > maxTicketContentLength {
		return "", common.NewMessage("Message must be 1 to {{max}} characters", map[string]any{"max": maxTicketContentLength})
	}
	return content, nil
}

// CreateTicket opens a ticket with its first message. categories is the
// configured category list the input must choose from.
func CreateTicket(userId int, input TicketInput, categories []string) (*Ticket, error) {
	category := strings.TrimSpace(input.Category)
	title := strings.TrimSpace(input.Title)
	reference := strings.TrimSpace(input.Reference)
	if !slices.Contains(categories, category) {
		return nil, common.NewMessage("Choose a ticket category")
	}
	if title == "" || utf8.RuneCountInString(title) > maxTicketTitleLength {
		return nil, common.NewMessage("Title must be 1 to {{max}} characters", map[string]any{"max": maxTicketTitleLength})
	}
	if utf8.RuneCountInString(reference) > maxTicketReferenceLength {
		return nil, common.NewMessage("Related order or request ID must be at most {{max}} characters", map[string]any{"max": maxTicketReferenceLength})
	}
	content, err := normalizeTicketContent(input.Content)
	if err != nil {
		return nil, err
	}

	ticket := &Ticket{}
	err = DB.Transaction(func(tx *gorm.DB) error {
		// Serializes a user's concurrent submissions so the open-ticket limit
		// holds.
		if err := lockForUpdate(tx).Select("id").Where("id = ?", userId).First(&User{}).Error; err != nil {
			return err
		}
		var open int64
		if err := tx.Model(&Ticket{}).Where("user_id = ? AND status <> ?", userId, TicketStatusClosed).Count(&open).Error; err != nil {
			return err
		}
		if open >= MaxOpenTicketsPerUser {
			return common.NewMessage("You can have at most {{max}} open tickets. Close a resolved one first.", map[string]any{"max": MaxOpenTicketsPerUser})
		}
		now := common.GetTimestamp()
		*ticket = Ticket{
			UserId:            userId,
			Category:          category,
			Title:             title,
			Reference:         reference,
			Status:            TicketStatusPending,
			CreatedTime:       now,
			UpdatedTime:       now,
			LastUserReplyTime: now,
		}
		if err := tx.Create(ticket).Error; err != nil {
			return err
		}
		return tx.Create(&TicketMessage{TicketId: ticket.Id, AuthorId: userId, Content: content, CreatedTime: now}).Error
	})
	if err != nil {
		return nil, err
	}
	return ticket, nil
}

// lockTicket loads a ticket under a row lock. ownerId 0 is an administrator;
// otherwise the ticket must belong to ownerId, and another user's ticket is
// reported as missing.
func lockTicket(tx *gorm.DB, id int, ownerId int) (*Ticket, error) {
	ticket := &Ticket{}
	err := lockForUpdate(tx).Where("id = ?", id).First(ticket).Error
	if errors.Is(err, gorm.ErrRecordNotFound) || (err == nil && ownerId != 0 && ticket.UserId != ownerId) {
		return nil, ErrTicketNotFound
	}
	if err != nil {
		return nil, err
	}
	return ticket, nil
}

// ReplyTicket adds a message. A user reply hands the ticket back to support
// and reopens it if it closed within the reopen window. A support reply hands
// it to the user; an internal note leaves the status and times unchanged.
func ReplyTicket(id int, authorId int, isAdmin bool, internal bool, content string) (*Ticket, error) {
	content, err := normalizeTicketContent(content)
	if err != nil {
		return nil, err
	}
	internal = internal && isAdmin
	ownerId := authorId
	if isAdmin {
		ownerId = 0
	}
	var ticket *Ticket
	err = DB.Transaction(func(tx *gorm.DB) error {
		var err error
		ticket, err = lockTicket(tx, id, ownerId)
		if err != nil {
			return err
		}
		now := common.GetTimestamp()
		if !isAdmin && ticket.Status == TicketStatusClosed && now-ticket.ClosedTime > TicketReopenWindowSeconds {
			return errTicketReopen
		}
		message := &TicketMessage{TicketId: id, AuthorId: authorId, IsAdmin: isAdmin, Internal: internal, Content: content, CreatedTime: now}
		if err := tx.Create(message).Error; err != nil {
			return err
		}
		if internal {
			return nil
		}
		if isAdmin {
			ticket.Status = TicketStatusReplied
			ticket.LastAdminReplyTime = now
		} else {
			ticket.Status = TicketStatusPending
			ticket.LastUserReplyTime = now
		}
		ticket.UpdatedTime = now
		ticket.ClosedTime = 0
		ticket.ClosedBy = ""
		return tx.Save(ticket).Error
	})
	if err != nil {
		return nil, err
	}
	return ticket, nil
}

// CloseTicket closes a ticket for its owner (isAdmin false) or an
// administrator. Closing a closed ticket changes nothing.
func CloseTicket(id int, actorId int, isAdmin bool) (*Ticket, error) {
	ownerId := actorId
	closedBy := TicketClosedByUser
	if isAdmin {
		ownerId = 0
		closedBy = TicketClosedByAdmin
	}
	var ticket *Ticket
	err := DB.Transaction(func(tx *gorm.DB) error {
		var err error
		ticket, err = lockTicket(tx, id, ownerId)
		if err != nil || ticket.Status == TicketStatusClosed {
			return err
		}
		now := common.GetTimestamp()
		ticket.Status = TicketStatusClosed
		ticket.ClosedTime = now
		ticket.ClosedBy = closedBy
		ticket.UpdatedTime = now
		return tx.Save(ticket).Error
	})
	if err != nil {
		return nil, err
	}
	return ticket, nil
}

// AutoCloseRepliedTickets closes tickets whose last support reply has gone
// unanswered for days. The status condition in the update keeps a reply that
// lands at the same time from being closed.
func AutoCloseRepliedTickets(days int, now int64) (int64, error) {
	if days <= 0 {
		return 0, nil
	}
	result := DB.Model(&Ticket{}).
		Where("status = ? AND last_admin_reply_time < ?", TicketStatusReplied, now-int64(days)*24*60*60).
		Updates(map[string]any{"status": TicketStatusClosed, "closed_time": now, "closed_by": TicketClosedByAuto})
	return result.RowsAffected, result.Error
}

// GetTicketDetail returns a ticket and its messages, oldest first. ownerId 0
// is an administrator and also sees internal notes.
func GetTicketDetail(id int, ownerId int) (*Ticket, []*TicketMessage, error) {
	ticket := &Ticket{}
	err := DB.Where("id = ?", id).First(ticket).Error
	if errors.Is(err, gorm.ErrRecordNotFound) || (err == nil && ownerId != 0 && ticket.UserId != ownerId) {
		return nil, nil, ErrTicketNotFound
	}
	if err != nil {
		return nil, nil, err
	}
	query := DB.Where("ticket_id = ?", id)
	if ownerId != 0 {
		query = query.Where("internal = ?", false)
	}
	var messages []*TicketMessage
	if err := query.Order("id asc").Find(&messages).Error; err != nil {
		return nil, nil, err
	}
	return ticket, messages, nil
}

// TicketFilter narrows a ticket list. UserId 0 lists every user's tickets,
// with the ones waiting for support first.
type TicketFilter struct {
	UserId   int
	Status   string
	Category string
}

func GetTickets(filter TicketFilter, pageInfo *common.PageInfo) (tickets []*Ticket, total int64, err error) {
	query := DB.Model(&Ticket{})
	if filter.UserId > 0 {
		query = query.Where("user_id = ?", filter.UserId)
	}
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	if filter.Category != "" {
		query = query.Where("category = ?", filter.Category)
	}
	query = query.Session(&gorm.Session{})
	if err = query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	ordered := query.Order("updated_time desc").Order("id desc")
	if filter.UserId == 0 {
		// One expression, because GORM drops an expression ORDER BY when
		// another Order call is merged into it.
		ordered = query.Order(clause.OrderBy{Expression: clause.Expr{
			SQL:                "CASE WHEN status = ? THEN 0 ELSE 1 END, updated_time DESC, id DESC",
			Vars:               []any{TicketStatusPending},
			WithoutParentheses: true,
		}})
	}
	err = ordered.Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&tickets).Error
	return tickets, total, err
}

// CountPendingTickets is the number of tickets waiting for support.
func CountPendingTickets() (int64, error) {
	var count int64
	err := DB.Model(&Ticket{}).Where("status = ?", TicketStatusPending).Count(&count).Error
	return count, err
}
