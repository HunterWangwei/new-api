/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import type { TFunction } from 'i18next'

import type { StatusBadgeProps } from '@/components/status-badge'

import type { TicketClosedBy, TicketStatus } from './types'

export const TICKET_STATUS_VALUES = [
  'pending',
  'replied',
  'closed',
] as const satisfies readonly TicketStatus[]

// labelKey values are i18n keys; use t(config.labelKey) in components
export const TICKET_STATUSES: Record<
  TicketStatus,
  Pick<StatusBadgeProps, 'variant'> & { labelKey: string }
> = {
  pending: { labelKey: 'Waiting for support', variant: 'warning' },
  replied: { labelKey: 'Replied', variant: 'info' },
  closed: { labelKey: 'Closed', variant: 'neutral' },
}

export const TICKET_CLOSED_BY_LABELS: Record<
  Exclude<TicketClosedBy, ''>,
  string
> = {
  user: 'Closed by the user',
  admin: 'Closed by customer service',
  auto: 'Closed automatically',
}

export function getTicketStatusOptions(t: TFunction) {
  return TICKET_STATUS_VALUES.map((value) => ({
    label: t(TICKET_STATUSES[value].labelKey),
    value,
  }))
}

// Mirror the server limits in model/ticket.go.
export const MAX_TICKET_TITLE_LENGTH = 100
export const MAX_TICKET_CONTENT_LENGTH = 5000
export const MAX_TICKET_REFERENCE_LENGTH = 128
export const TICKET_REOPEN_WINDOW_SECONDS = 7 * 24 * 60 * 60

// The default category the invoice verification page preselects; see
// setting/ticket_setting/config.go.
export const INVOICE_TICKET_CATEGORY = 'Invoices & verification'

export const ticketQueryKeys = {
  all: ['tickets'] as const,
  options: () => [...ticketQueryKeys.all, 'options'] as const,
  pendingCount: () => [...ticketQueryKeys.all, 'pending-count'] as const,
  list: (
    admin: boolean,
    page: number,
    pageSize: number,
    status: string,
    category: string
  ) =>
    [
      ...ticketQueryKeys.all,
      admin ? 'admin' : 'self',
      page,
      pageSize,
      status,
      category,
    ] as const,
  detail: (admin: boolean, id: number) =>
    [...ticketQueryKeys.all, 'detail', admin ? 'admin' : 'self', id] as const,
}
