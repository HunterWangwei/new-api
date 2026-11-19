package ticket_setting

import (
	"slices"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

// TicketSetting is edited on the Console Content > Tickets settings page.
type TicketSetting struct {
	// Categories users choose from when they open a ticket. The defaults are
	// English source text that the web console translates; names an
	// administrator types are shown as written.
	Categories []string `json:"categories"`
	// AutoCloseDays closes a ticket the user has not answered this many days
	// after the last support reply. 0 turns automatic closing off.
	AutoCloseDays int `json:"auto_close_days"`
}

const (
	CategoriesOptionKey    = "ticket_setting.categories"
	AutoCloseDaysOptionKey = "ticket_setting.auto_close_days"

	MaxCategories       = 20
	MaxCategoryLength   = 30
	MaxAutoCloseDays    = 90
	DefaultCloseDays    = 7
	InvoiceCategoryName = "Invoices & verification"
)

var ticketSetting = TicketSetting{
	Categories:    []string{"Billing & top-up", "API issues", InvoiceCategoryName, "Account", "Other"},
	AutoCloseDays: DefaultCloseDays,
}

func init() {
	config.GlobalConfig.Register("ticket_setting", &ticketSetting)
}

// Categories returns a copy of the configured categories.
func Categories() []string {
	return slices.Clone(ticketSetting.Categories)
}

func AutoCloseDays() int {
	return ticketSetting.AutoCloseDays
}

// ValidateOption checks a ticket setting before it is saved; other keys pass.
func ValidateOption(key string, value string) error {
	switch key {
	case CategoriesOptionKey:
		var categories []string
		if err := common.UnmarshalJsonStr(value, &categories); err != nil {
			return common.NewMessage("Ticket categories must be a list of names")
		}
		if len(categories) == 0 || len(categories) > MaxCategories {
			return common.NewMessage("Configure 1 to {{max}} ticket categories", map[string]any{"max": MaxCategories})
		}
		for i, name := range categories {
			if strings.TrimSpace(name) != name || name == "" || utf8.RuneCountInString(name) > MaxCategoryLength {
				return common.NewMessage("Ticket category names must be 1 to {{max}} characters without leading or trailing spaces", map[string]any{"max": MaxCategoryLength})
			}
			if slices.Contains(categories[:i], name) {
				return common.NewMessage("Ticket category {{name}} is listed twice", map[string]any{"name": name})
			}
		}
	case AutoCloseDaysOptionKey:
		days, err := strconv.Atoi(value)
		if err != nil || days < 0 || days > MaxAutoCloseDays {
			return common.NewMessage("Automatic closing must be 0 to {{max}} days", map[string]any{"max": MaxAutoCloseDays})
		}
	}
	return nil
}
