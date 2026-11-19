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
export type InvoiceStatus = 'pending' | 'issued' | 'rejected' | 'voided'

export type InvoiceSubjectType = 'personal' | 'company'

export type VerificationStatus = 'pending' | 'approved' | 'rejected'

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

export interface PageData<T> {
  items: T[] | null
  total: number
}

export interface InvoiceVerification {
  id: number
  user_id: number
  type: InvoiceSubjectType
  name: string
  /** Masked for personal subjects in the user's own view. */
  id_number: string
  email: string
  status: VerificationStatus
  reject_reason: string
  created_time: number
  updated_time: number
  handled_time: number
}

export interface InvoiceVerificationInput {
  type: InvoiceSubjectType
  name: string
  id_number: string
  email: string
}

export interface MyInvoiceVerification {
  verification: InvoiceVerification | null
}

export interface Invoice {
  id: number
  user_id: number
  status: InvoiceStatus
  amount_cents: number
  title_type: InvoiceSubjectType
  title_name: string
  tax_no: string
  email: string
  remark: string
  invoice_no: string
  reject_reason: string
  trade_nos: string
  created_time: number
  handled_time: number
  has_file: boolean
}

export interface EligibleTopUp {
  id: number
  trade_no: string
  money: number
  payment_method: string
  complete_time: number
}

export interface ListInvoicesParams {
  p: number
  page_size: number
  status?: string
  user_id?: number
}
