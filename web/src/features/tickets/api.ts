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
import { api } from '@/lib/api'

import type {
  ApiResponse,
  ListTicketsParams,
  PageData,
  Ticket,
  TicketDetail,
  TicketInput,
  TicketOptions,
} from './types'

function listQuery(params: ListTicketsParams): string {
  const query = new URLSearchParams()
  query.set('p', String(params.p))
  query.set('page_size', String(params.page_size))
  if (params.status) query.set('status', params.status)
  if (params.category) query.set('category', params.category)
  return query.toString()
}

// Users act on their own tickets under /ticket/self; administrators act on
// any ticket under /ticket.
function ticketPath(admin: boolean, id: number): string {
  return admin ? `/api/user/ticket/${id}` : `/api/user/ticket/self/${id}`
}

export async function getTicketOptions(): Promise<ApiResponse<TicketOptions>> {
  const res = await api.get('/api/user/ticket/options')
  return res.data
}

export async function getTickets(
  admin: boolean,
  params: ListTicketsParams
): Promise<ApiResponse<PageData<Ticket>>> {
  const base = admin ? '/api/user/ticket' : '/api/user/ticket/self'
  const res = await api.get(`${base}?${listQuery(params)}`)
  return res.data
}

export async function createTicket(
  input: TicketInput
): Promise<ApiResponse<Ticket>> {
  const res = await api.post('/api/user/ticket', input)
  return res.data
}

export async function getTicket(
  admin: boolean,
  id: number
): Promise<ApiResponse<TicketDetail>> {
  const res = await api.get(ticketPath(admin, id))
  return res.data
}

export async function replyTicket(
  admin: boolean,
  id: number,
  content: string,
  internal: boolean
): Promise<ApiResponse<TicketDetail>> {
  const res = await api.post(`${ticketPath(admin, id)}/reply`, {
    content,
    internal: admin && internal,
  })
  return res.data
}

export async function closeTicket(
  admin: boolean,
  id: number
): Promise<ApiResponse<Ticket>> {
  const res = await api.post(`${ticketPath(admin, id)}/close`)
  return res.data
}

export async function getTicketPendingCount(): Promise<
  ApiResponse<{ count: number }>
> {
  const res = await api.get('/api/user/ticket/pending_count')
  return res.data
}
