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
import { z } from 'zod'

import type { InvoiceVerification, InvoiceVerificationInput } from '../types'

// Same rule as invoiceTaxNoPattern in model/invoice_verification.go: the
// unified social credit code (18 characters) or a legacy number of 15, 17 or
// 20 characters.
const TAX_NO_PATTERN = /^[0-9A-Z]{15}$|^[0-9A-Z]{17,18}$|^[0-9A-Z]{20}$/

const RESIDENT_ID_WEIGHTS = [
  7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2,
]

/** Mirrors isValidResidentId: 18 characters with the GB 11643 check digit. */
export function isValidResidentId(value: string): boolean {
  if (!/^[0-9]{17}[0-9X]$/.test(value)) return false
  let sum = 0
  for (const [index, weight] of RESIDENT_ID_WEIGHTS.entries()) {
    sum += Number(value[index]) * weight
  }
  return value[17] === '10X98765432'[sum % 11]
}

export function getVerificationFormSchema(t: TFunction) {
  return z
    .object({
      type: z.enum(['personal', 'company']),
      name: z
        .string()
        .trim()
        .min(1, t('Enter the name'))
        .max(100, t('Name must be at most 100 characters')),
      id_number: z.string().trim(),
      email: z
        .string()
        .trim()
        .refine(
          (value) =>
            value === '' || z.string().email().safeParse(value).success,
          t('Invalid email address')
        ),
    })
    .superRefine((value, ctx) => {
      // The server stores the number upper-cased, so case is not an error.
      const idNumber = value.id_number.toUpperCase()
      if (value.type === 'personal' && !isValidResidentId(idNumber)) {
        ctx.addIssue({
          code: 'custom',
          path: ['id_number'],
          message: t('Enter a valid resident identity card number'),
        })
      }
      if (value.type === 'company' && !TAX_NO_PATTERN.test(idNumber)) {
        ctx.addIssue({
          code: 'custom',
          path: ['id_number'],
          message: t('Enter a valid taxpayer identification number'),
        })
      }
    })
}

export type VerificationFormValues = InvoiceVerificationInput

/**
 * Prefills a resubmission with the current details. The identity number is
 * left empty: the user's own view only carries a masked personal number.
 */
export function verificationToFormValues(
  verification: InvoiceVerification | null
): VerificationFormValues {
  return {
    type: verification?.type ?? 'company',
    name: verification?.name ?? '',
    id_number: '',
    email: verification?.email ?? '',
  }
}
