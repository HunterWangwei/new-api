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
import { t } from 'i18next'

import { api } from '@/lib/api'
import { createServerError } from '@/lib/server-error-message'

import type {
  ApiResponse,
  EligibleTopUp,
  Invoice,
  InvoiceVerification,
  InvoiceVerificationInput,
  ListInvoicesParams,
  MyInvoiceVerification,
  PageData,
} from './types'

function listQuery(params: ListInvoicesParams): string {
  const query = new URLSearchParams()
  query.set('p', String(params.p))
  query.set('page_size', String(params.page_size))
  if (params.status) query.set('status', params.status)
  if (params.user_id) query.set('user_id', String(params.user_id))
  return query.toString()
}

export async function getMyInvoiceVerification(): Promise<
  ApiResponse<MyInvoiceVerification>
> {
  const res = await api.get('/api/user/invoice/verification')
  return res.data
}

export async function submitInvoiceVerification(
  input: InvoiceVerificationInput
): Promise<ApiResponse<MyInvoiceVerification>> {
  const res = await api.post('/api/user/invoice/verification', input)
  return res.data
}

export async function getInvoiceVerifications(
  params: ListInvoicesParams
): Promise<ApiResponse<PageData<InvoiceVerification>>> {
  const res = await api.get(
    `/api/user/invoice/verifications?${listQuery(params)}`
  )
  return res.data
}

export async function approveInvoiceVerification(
  id: number
): Promise<ApiResponse<InvoiceVerification>> {
  const res = await api.post(`/api/user/invoice/verifications/${id}/approve`)
  return res.data
}

export async function rejectInvoiceVerification(
  id: number,
  reason: string
): Promise<ApiResponse<InvoiceVerification>> {
  const res = await api.post(`/api/user/invoice/verifications/${id}/reject`, {
    reason,
  })
  return res.data
}

export async function getEligibleTopUps(
  p: number,
  pageSize: number
): Promise<ApiResponse<PageData<EligibleTopUp>>> {
  const res = await api.get(
    `/api/user/invoice/eligible?p=${p}&page_size=${pageSize}`
  )
  return res.data
}

export async function applyInvoice(payload: {
  top_up_ids: number[]
  remark: string
}): Promise<ApiResponse<Invoice>> {
  const res = await api.post('/api/user/invoice', payload)
  return res.data
}

export async function getUserInvoices(
  params: ListInvoicesParams
): Promise<ApiResponse<PageData<Invoice>>> {
  const res = await api.get(`/api/user/invoice/self?${listQuery(params)}`)
  return res.data
}

export async function getAllInvoices(
  params: ListInvoicesParams
): Promise<ApiResponse<PageData<Invoice>>> {
  const res = await api.get(`/api/user/invoice?${listQuery(params)}`)
  return res.data
}

export async function issueInvoice(
  id: number,
  invoiceNo: string,
  file: File
): Promise<ApiResponse<Invoice>> {
  const form = new FormData()
  form.append('invoice_no', invoiceNo)
  form.append('file', file)
  const res = await api.post(`/api/user/invoice/${id}/issue`, form)
  return res.data
}

export async function rejectInvoice(
  id: number,
  reason: string
): Promise<ApiResponse<Invoice>> {
  const res = await api.post(`/api/user/invoice/${id}/reject`, { reason })
  return res.data
}

export async function voidInvoice(id: number): Promise<ApiResponse<Invoice>> {
  const res = await api.post(`/api/user/invoice/${id}/void`)
  return res.data
}

// The endpoint answers with the PDF, or with a JSON error body when the
// invoice is missing or not accessible, so the blob type decides which.
export async function downloadInvoiceFile(invoice: Invoice): Promise<void> {
  const res = await api.get<Blob>(`/api/user/invoice/${invoice.id}/file`, {
    responseType: 'blob',
    disableDuplicate: true,
  })
  const blob = res.data
  if (blob.type !== 'application/pdf') {
    let body: unknown = null
    try {
      body = JSON.parse(await blob.text())
    } catch {
      // Not a JSON error body; fall back to the generic message.
    }
    throw createServerError(body, t('Failed to download invoice'))
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `invoice-${invoice.invoice_no || invoice.id}.pdf`
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
