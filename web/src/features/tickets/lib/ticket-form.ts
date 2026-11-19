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

import {
  MAX_TICKET_CONTENT_LENGTH,
  MAX_TICKET_REFERENCE_LENGTH,
  MAX_TICKET_TITLE_LENGTH,
} from '../constants'
import type { TicketInput } from '../types'

export function getTicketFormSchema(t: TFunction) {
  return z.object({
    category: z.string().min(1, t('Choose a ticket category')),
    title: z
      .string()
      .trim()
      .min(1, t('Enter a title'))
      .max(
        MAX_TICKET_TITLE_LENGTH,
        t('Title must be at most {{max}} characters', {
          max: MAX_TICKET_TITLE_LENGTH,
        })
      ),
    reference: z
      .string()
      .trim()
      .max(
        MAX_TICKET_REFERENCE_LENGTH,
        t('Related order or request ID must be at most {{max}} characters', {
          max: MAX_TICKET_REFERENCE_LENGTH,
        })
      ),
    content: z
      .string()
      .trim()
      .min(1, t('Describe the problem'))
      .max(
        MAX_TICKET_CONTENT_LENGTH,
        t('Message must be at most {{max}} characters', {
          max: MAX_TICKET_CONTENT_LENGTH,
        })
      ),
  })
}

export type TicketFormValues = TicketInput

/**
 * Turns the category editor's text (one name per line) into the stored list:
 * trimmed, without blank lines or repeats, in the order entered.
 */
export function categoriesFromLines(text: string): string[] {
  const names: string[] = []
  for (const line of text.split('\n')) {
    const name = line.trim()
    if (name && !names.includes(name)) names.push(name)
  }
  return names
}

/** Reads the stored category list; malformed values count as empty. */
export function parseCategories(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string')
  } catch {
    return []
  }
}
