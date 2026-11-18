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
import { describe, expect, test } from 'vitest'

import { formatInvoiceAmount, sumSelectedCents } from '../lib/format'

describe('invoice amounts', () => {
  test.each([
    [0, '¥0.00'],
    [5, '¥0.05'],
    [3030, '¥30.30'],
    [1234567, '¥12345.67'],
  ])('formats %i fen as %s', (cents, expected) => {
    expect(formatInvoiceAmount(cents)).toBe(expected)
  })

  test('sums only the selected orders, each rounded to fen', () => {
    const orders = [
      { id: 1, money: 10.1 },
      { id: 2, money: 20.2 },
      { id: 3, money: 99 },
    ]

    expect(sumSelectedCents(orders, new Set([1, 2]))).toBe(3030)
  })

  test('returns zero when nothing is selected', () => {
    expect(sumSelectedCents([{ id: 1, money: 10 }], new Set())).toBe(0)
  })
})
