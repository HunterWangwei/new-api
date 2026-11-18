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
import { describe, expect, test } from 'vitest'

import {
  getVerificationFormSchema,
  verificationToFormValues,
  type VerificationFormValues,
} from '../lib/verification-form'

const t = ((key: string) => key) as unknown as TFunction
const schema = getVerificationFormSchema(t)

function errorPaths(values: VerificationFormValues): string[] {
  const result = schema.safeParse(values)
  if (result.success) return []
  return result.error.issues.map((issue) => issue.path.join('.'))
}

const personal: VerificationFormValues = {
  type: 'personal',
  name: 'Zhang San',
  id_number: '11010519491231002x',
  email: '',
}

describe('identity verification form validation', () => {
  test('personal subject with a valid identity card number is accepted', () => {
    expect(errorPaths(personal)).toEqual([])
  })

  test.each(['110105194912310021', '110105491231002', ''])(
    'personal subject with identity number %j is rejected on id_number',
    (idNumber) => {
      expect(errorPaths({ ...personal, id_number: idNumber })).toEqual([
        'id_number',
      ])
    }
  )

  test('company subject with a lower-case credit code is accepted', () => {
    expect(
      errorPaths({
        type: 'company',
        name: 'Example Co.',
        id_number: '91110000ma01abcd2x',
        email: 'finance@example.com',
      })
    ).toEqual([])
  })

  test('company subject with a malformed tax number is rejected on id_number', () => {
    expect(
      errorPaths({
        type: 'company',
        name: 'Example Co.',
        id_number: '9111-0000',
        email: '',
      })
    ).toEqual(['id_number'])
  })

  test('blank name and malformed email are reported on their fields', () => {
    expect(errorPaths({ ...personal, name: '  ', email: 'nope' })).toEqual([
      'name',
      'email',
    ])
  })

  test('resubmission keeps the subject but asks for the identity number again', () => {
    expect(
      verificationToFormValues({
        id: 1,
        user_id: 1,
        type: 'personal',
        name: 'Zhang San',
        id_number: '1101**********002X',
        email: 'a@example.com',
        status: 'rejected',
        reject_reason: 'mismatch',
        created_time: 1,
        updated_time: 1,
        handled_time: 1,
      })
    ).toEqual({
      type: 'personal',
      name: 'Zhang San',
      id_number: '',
      email: 'a@example.com',
    })
  })
})
