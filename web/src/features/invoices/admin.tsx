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
import { Ban, Download, FileCheck2, XCircle } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTableRowActionMenu } from '@/components/data-table'
import { SectionPageLayout } from '@/components/layout'
import {
  DropdownMenuItem,
  DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { handleServerError } from '@/lib/handle-server-error'

import { downloadInvoiceFile } from './api'
import {
  InvoiceAdminDialog,
  type InvoiceAdminAction,
} from './components/invoice-admin-dialogs'
import { InvoicesTable } from './components/invoices-table'
import { VerificationsTable } from './components/verifications-table'
import type { Invoice } from './types'

const route = getRouteApi('/_authenticated/invoice-management/')

export function InvoiceManagement() {
  const { t } = useTranslation()
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const tab = search.tab ?? 'invoices'
  const [selection, setSelection] = useState<{
    action: InvoiceAdminAction
    invoice: Invoice
  } | null>(null)

  const renderActions = (invoice: Invoice) => {
    const canDownload = invoice.has_file
    if (
      invoice.status !== 'pending' &&
      invoice.status !== 'issued' &&
      !canDownload
    ) {
      return null
    }
    return (
      <DataTableRowActionMenu ariaLabel={t('Open menu')} modal={false}>
        {invoice.status === 'pending' && (
          <>
            <DropdownMenuItem
              onClick={() => setSelection({ action: 'issue', invoice })}
            >
              {t('Issue')}
              <DropdownMenuShortcut>
                <FileCheck2 size={16} />
              </DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem
              className='text-destructive focus:text-destructive'
              onClick={() => setSelection({ action: 'reject', invoice })}
            >
              {t('Reject')}
              <DropdownMenuShortcut>
                <XCircle size={16} />
              </DropdownMenuShortcut>
            </DropdownMenuItem>
          </>
        )}
        {canDownload && (
          <DropdownMenuItem
            onClick={() =>
              void downloadInvoiceFile(invoice).catch((error: unknown) =>
                handleServerError(error)
              )
            }
          >
            {t('Download')}
            <DropdownMenuShortcut>
              <Download size={16} />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        )}
        {invoice.status === 'issued' && (
          <DropdownMenuItem
            className='text-destructive focus:text-destructive'
            onClick={() => setSelection({ action: 'void', invoice })}
          >
            {t('Void')}
            <DropdownMenuShortcut>
              <Ban size={16} />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        )}
      </DataTableRowActionMenu>
    )
  }

  return (
    <>
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>
          {t('Invoice Management')}
        </SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <Tabs
            value={tab}
            onValueChange={(value) => {
              if (value === 'invoices' || value === 'verifications') {
                void navigate({ search: (prev) => ({ ...prev, tab: value }) })
              }
            }}
            className='flex h-full min-h-0 flex-col gap-4'
          >
            <TabsList>
              <TabsTrigger value='invoices'>
                {t('Invoice applications')}
              </TabsTrigger>
              <TabsTrigger value='verifications'>
                {t('Verification review')}
              </TabsTrigger>
            </TabsList>
            <TabsContent value='invoices' className='min-h-0 flex-1'>
              <InvoicesTable
                admin
                search={search}
                navigate={navigate}
                renderActions={renderActions}
              />
            </TabsContent>
            <TabsContent value='verifications' className='min-h-0 flex-1'>
              <VerificationsTable search={search} navigate={navigate} />
            </TabsContent>
          </Tabs>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      {selection && (
        <InvoiceAdminDialog
          key={`${selection.action}-${selection.invoice.id}`}
          action={selection.action}
          invoice={selection.invoice}
          onClose={() => setSelection(null)}
        />
      )}
    </>
  )
}
