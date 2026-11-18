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

import type {
  InvoiceStatus,
  InvoiceSubjectType,
  VerificationStatus,
} from './types'

export const INVOICE_STATUS_VALUES = [
  'pending',
  'issued',
  'rejected',
  'voided',
] as const satisfies readonly InvoiceStatus[]

// labelKey values are i18n keys; use t(config.labelKey) in components
export const INVOICE_STATUSES: Record<
  InvoiceStatus,
  Pick<StatusBadgeProps, 'variant'> & { labelKey: string }
> = {
  pending: { labelKey: 'Pending review', variant: 'warning' },
  issued: { labelKey: 'Issued', variant: 'success' },
  rejected: { labelKey: 'Rejected', variant: 'danger' },
  voided: { labelKey: 'Voided', variant: 'neutral' },
}

export const INVOICE_SUBJECT_TYPE_LABELS: Record<InvoiceSubjectType, string> = {
  personal: 'Personal',
  company: 'Company',
}

export const VERIFICATION_STATUS_VALUES = [
  'pending',
  'approved',
  'rejected',
] as const satisfies readonly VerificationStatus[]

// labelKey values are i18n keys; use t(config.labelKey) in components
export const VERIFICATION_STATUSES: Record<
  VerificationStatus,
  Pick<StatusBadgeProps, 'variant'> & { labelKey: string }
> = {
  pending: { labelKey: 'Pending review', variant: 'warning' },
  approved: { labelKey: 'Verified', variant: 'success' },
  rejected: { labelKey: 'Rejected', variant: 'danger' },
}

export function getVerificationStatusOptions(t: TFunction) {
  return VERIFICATION_STATUS_VALUES.map((value) => ({
    label: t(VERIFICATION_STATUSES[value].labelKey),
    value,
  }))
}

export function getInvoiceStatusOptions(t: TFunction) {
  return INVOICE_STATUS_VALUES.map((value) => ({
    label: t(INVOICE_STATUSES[value].labelKey),
    value,
  }))
}

// Mirror the server limits in model/invoice.go and controller/invoice.go.
export const MAX_INVOICE_TOPUPS_PER_APPLY = 100
export const MAX_INVOICE_FILE_MB = 10

export const invoiceQueryKeys = {
  all: ['invoices'] as const,
  myVerification: () => [...invoiceQueryKeys.all, 'my-verification'] as const,
  verifications: (page: number, pageSize: number, status: string) =>
    [...invoiceQueryKeys.all, 'verifications', page, pageSize, status] as const,
  eligible: (page: number, pageSize: number) =>
    [...invoiceQueryKeys.all, 'eligible', page, pageSize] as const,
  self: (page: number, pageSize: number, status: string) =>
    [...invoiceQueryKeys.all, 'self', page, pageSize, status] as const,
  admin: (page: number, pageSize: number, status: string) =>
    [...invoiceQueryKeys.all, 'admin', page, pageSize, status] as const,
}
