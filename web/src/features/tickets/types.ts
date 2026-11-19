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
export type TicketStatus = 'pending' | 'replied' | 'closed'

export type TicketClosedBy = '' | 'user' | 'admin' | 'auto'

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

export interface PageData<T> {
  items: T[] | null
  total: number
}

export interface Ticket {
  id: number
  user_id: number
  category: string
  title: string
  reference: string
  status: TicketStatus
  created_time: number
  updated_time: number
  last_user_reply_time: number
  last_admin_reply_time: number
  closed_time: number
  closed_by: TicketClosedBy
}

export interface TicketMessage {
  id: number
  ticket_id: number
  author_id: number
  is_admin: boolean
  internal: boolean
  content: string
  created_time: number
}

export interface TicketDetail {
  ticket: Ticket
  messages: TicketMessage[] | null
}

export interface TicketOptions {
  categories: string[] | null
  auto_close_days: number
}

export interface TicketInput {
  category: string
  title: string
  reference: string
  content: string
}

export interface ListTicketsParams {
  p: number
  page_size: number
  status?: string
  category?: string
}
