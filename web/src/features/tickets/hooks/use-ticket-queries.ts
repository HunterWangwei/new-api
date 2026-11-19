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
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'
import { ROLE } from '@/lib/roles'
import { requireServerSuccess } from '@/lib/server-error-message'
import { useAuthStore } from '@/stores/auth-store'

import { getTicketOptions, getTicketPendingCount } from '../api'
import { ticketQueryKeys } from '../constants'

export function useTicketOptions() {
  return useQuery({
    queryKey: ticketQueryKeys.options(),
    queryFn: async () => requireServerSuccess(await getTicketOptions()),
    select: (response) => ({
      categories: response.data?.categories ?? [],
      autoCloseDays: response.data?.auto_close_days ?? 0,
    }),
  })
}

/**
 * Number of tickets waiting for support, for the admin sidebar entry. Only
 * administrators query it; it refreshes every minute.
 */
export function useTicketPendingBadge(): string | undefined {
  const { i18n } = useTranslation()
  const role = useAuthStore((state) => state.auth.user?.role)
  const isAdmin = (role ?? ROLE.GUEST) >= ROLE.ADMIN
  const query = useQuery({
    queryKey: ticketQueryKeys.pendingCount(),
    queryFn: async () => requireServerSuccess(await getTicketPendingCount()),
    enabled: isAdmin,
    refetchInterval: 60_000,
    meta: { errorToast: false },
  })
  const count = query.data?.data?.count ?? 0
  if (!isAdmin || count === 0) return undefined
  return formatNumber(
    count,
    toIntlLocale(i18n.resolvedLanguage || i18n.language)
  )
}
