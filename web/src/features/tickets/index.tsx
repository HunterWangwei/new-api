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
import { MessageSquarePlus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'

import { CreateTicketDialog } from './components/create-ticket-dialog'
import { TicketDetailSheet } from './components/ticket-detail-sheet'
import { TicketsTable } from './components/tickets-table'
import { INVOICE_TICKET_CATEGORY } from './constants'
import { useTicketOptions } from './hooks/use-ticket-queries'
import type { TicketFormValues } from './lib/ticket-form'

const route = getRouteApi('/_authenticated/tickets/')

export function Tickets() {
  const { t } = useTranslation()
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const options = useTicketOptions()
  const categories = useMemo(
    () => options.data?.categories ?? [],
    [options.data?.categories]
  )
  const [createOpen, setCreateOpen] = useState(false)
  const [preset, setPreset] = useState<Partial<TicketFormValues>>()
  const [openTicketId, setOpenTicketId] = useState<number | null>(null)

  // The invoice page links here with ?create=invoice to ask about a pending
  // verification. Open the form once and drop the flag so a reload does not
  // open it again.
  const createFor = search.create
  useEffect(() => {
    if (createFor !== 'invoice' || !options.isSuccess) return
    setPreset({
      category: categories.includes(INVOICE_TICKET_CATEGORY)
        ? INVOICE_TICKET_CATEGORY
        : '',
      title: t('Invoice verification review'),
    })
    setCreateOpen(true)
    void navigate({
      search: (prev) => ({ ...prev, create: undefined }),
      replace: true,
    })
  }, [createFor, options.isSuccess, categories, navigate, t])

  const openNew = () => {
    setPreset(undefined)
    setCreateOpen(true)
  }

  return (
    <>
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>{t('Tickets')}</SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          <Button
            className='gap-2'
            disabled={categories.length === 0}
            onClick={openNew}
          >
            <MessageSquarePlus className='size-4' aria-hidden='true' />
            {t('New ticket')}
          </Button>
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <TicketsTable
            admin={false}
            search={search}
            navigate={navigate}
            categories={categories}
            onOpen={(ticket) => setOpenTicketId(ticket.id)}
          />
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <CreateTicketDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        categories={categories}
        preset={preset}
        onCreated={(ticket) => setOpenTicketId(ticket.id)}
      />
      <TicketDetailSheet
        ticketId={openTicketId}
        admin={false}
        onClose={() => setOpenTicketId(null)}
      />
    </>
  )
}
