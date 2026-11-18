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
import { Download, FilePlus2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { handleServerError } from '@/lib/handle-server-error'

import { downloadInvoiceFile } from './api'
import { ApplyInvoiceDialog } from './components/apply-invoice-dialog'
import { InvoicesTable } from './components/invoices-table'
import { VerificationFormDialog } from './components/verification-form-dialog'
import { VerificationStatusCard } from './components/verification-status-card'
import { useMyVerification } from './hooks/use-my-verification'
import type { Invoice } from './types'

const route = getRouteApi('/_authenticated/invoices/')

export function Invoices() {
  const { t } = useTranslation()
  const [applyOpen, setApplyOpen] = useState(false)
  const [verificationOpen, setVerificationOpen] = useState(false)
  const myVerification = useMyVerification()
  const verification = myVerification.data?.verification ?? null
  const verified = verification?.status === 'approved'

  const renderActions = (invoice: Invoice) =>
    invoice.status === 'issued' && invoice.has_file ? (
      <Button
        variant='ghost'
        size='sm'
        className='gap-1.5'
        onClick={() =>
          void downloadInvoiceFile(invoice).catch((error: unknown) =>
            handleServerError(error)
          )
        }
      >
        <Download className='size-4' aria-hidden='true' />
        {t('Download')}
      </Button>
    ) : null

  return (
    <>
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>{t('Invoices')}</SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          <Button
            className='gap-2'
            disabled={!verified}
            title={
              verified
                ? undefined
                : t('Apply after identity verification is approved')
            }
            onClick={() => setApplyOpen(true)}
          >
            <FilePlus2 className='size-4' aria-hidden='true' />
            {t('Apply for invoice')}
          </Button>
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <div className='flex h-full min-h-0 flex-col gap-4'>
            {myVerification.isSuccess && (
              <VerificationStatusCard
                verification={verification}
                supportContact={myVerification.data.supportContact}
                onEdit={() => setVerificationOpen(true)}
              />
            )}
            <div className='min-h-0 flex-1'>
              <InvoicesTable
                admin={false}
                search={route.useSearch()}
                navigate={route.useNavigate()}
                renderActions={renderActions}
              />
            </div>
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      {verified && verification && (
        <ApplyInvoiceDialog
          open={applyOpen}
          onOpenChange={setApplyOpen}
          verification={verification}
        />
      )}
      <VerificationFormDialog
        open={verificationOpen}
        onOpenChange={setVerificationOpen}
        verification={verification}
      />
    </>
  )
}
