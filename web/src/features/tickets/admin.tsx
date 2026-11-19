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
import { getRouteApi } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'

import { TicketDetailSheet } from './components/ticket-detail-sheet'
import { TicketsTable } from './components/tickets-table'
import { useTicketOptions } from './hooks/use-ticket-queries'

const route = getRouteApi('/_authenticated/ticket-management/')

export function TicketManagement() {
  const { t } = useTranslation()
  const options = useTicketOptions()
  const [openTicketId, setOpenTicketId] = useState<number | null>(null)

  return (
    <>
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>
          {t('Ticket Management')}
        </SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <TicketsTable
            admin
            search={route.useSearch()}
            navigate={route.useNavigate()}
            categories={options.data?.categories ?? []}
            onOpen={(ticket) => setOpenTicketId(ticket.id)}
          />
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <TicketDetailSheet
        ticketId={openTicketId}
        admin
        onClose={() => setOpenTicketId(null)}
      />
    </>
  )
}
