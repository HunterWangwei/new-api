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
/**
 * Formats an amount stored in fen (1/100 CNY) as yuan with two decimals.
 * Invoices are always in CNY, whatever display currency the site uses.
 */
export function formatInvoiceAmount(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(Math.trunc(cents))
  const yuan = Math.floor(abs / 100)
  const fen = String(abs % 100).padStart(2, '0')
  return `${sign}¥${yuan}.${fen}`
}

/** Mirrors the server rounding of a top-up's money to fen. */
export function moneyToCents(money: number): number {
  return Math.round(money * 100)
}

/** Sums the selected orders the way the server does: per order, in fen. */
export function sumSelectedCents(
  orders: { id: number; money: number }[],
  selectedIds: ReadonlySet<number>
): number {
  let total = 0
  for (const order of orders) {
    if (selectedIds.has(order.id)) total += moneyToCents(order.money)
  }
  return total
}
