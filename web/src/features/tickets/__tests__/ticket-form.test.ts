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
  categoriesFromLines,
  getTicketFormSchema,
  parseCategories,
  type TicketFormValues,
} from '../lib/ticket-form'

const t = ((key: string) => key) as unknown as TFunction
const schema = getTicketFormSchema(t)

function errorPaths(values: TicketFormValues): string[] {
  const result = schema.safeParse(values)
  if (result.success) return []
  return result.error.issues.map((issue) => issue.path.join('.'))
}

const valid: TicketFormValues = {
  category: 'API issues',
  title: 'Requests fail with 500',
  reference: '',
  content: 'Since this morning every request fails.',
}

describe('ticket form validation', () => {
  test('a complete ticket without a reference is accepted', () => {
    expect(errorPaths(valid)).toEqual([])
  })

  test('missing category, blank title and blank content are reported on their fields', () => {
    expect(
      errorPaths({ ...valid, category: '', title: '  ', content: '\n' })
    ).toEqual(['category', 'title', 'content'])
  })

  test('a title longer than 100 characters is rejected', () => {
    expect(errorPaths({ ...valid, title: 'x'.repeat(101) })).toEqual(['title'])
  })
})

describe('ticket category list', () => {
  test('lines become trimmed names without blanks or repeats, in order', () => {
    expect(categoriesFromLines(' Billing \n\nAPI issues\nBilling\n  ')).toEqual(
      ['Billing', 'API issues']
    )
  })

  test.each(['', 'not json', '{"a":1}'])(
    'a malformed stored value %j reads as no categories',
    (value) => {
      expect(parseCategories(value)).toEqual([])
    }
  )

  test('non-string entries in the stored list are ignored', () => {
    expect(parseCategories('["Other", 3, null]')).toEqual(['Other'])
  })
})
