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
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { handleServerError } from '@/lib/handle-server-error'
import { createServerError } from '@/lib/server-error-message'

import { issueInvoice, rejectInvoice, voidInvoice } from '../api'
import { MAX_INVOICE_FILE_MB, invoiceQueryKeys } from '../constants'
import { formatInvoiceAmount } from '../lib/format'
import type { ApiResponse, Invoice } from '../types'

export type InvoiceAdminAction = 'issue' | 'reject' | 'void'

type InvoiceAdminDialogProps = {
  action: InvoiceAdminAction
  invoice: Invoice
  onClose: () => void
}

// Mounted once per selected action, so its local state starts empty.
export function InvoiceAdminDialog(props: InvoiceAdminDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [invoiceNo, setInvoiceNo] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [reason, setReason] = useState('')
  const invoice = props.invoice

  const run = useMutation({
    mutationFn: async () => {
      let result: ApiResponse<Invoice>
      if (props.action === 'issue') {
        if (!file) throw new Error(t('Upload the invoice PDF'))
        result = await issueInvoice(invoice.id, invoiceNo.trim(), file)
      } else if (props.action === 'reject') {
        result = await rejectInvoice(invoice.id, reason.trim())
      } else {
        result = await voidInvoice(invoice.id)
      }
      if (!result.success) {
        throw createServerError(result, t('Operation failed'))
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: invoiceQueryKeys.all })
      toast.success(t('Invoice updated'))
      props.onClose()
    },
    onError: (error) => handleServerError(error),
  })

  const fileTooLarge =
    file !== null && file.size > MAX_INVOICE_FILE_MB * 1024 * 1024
  let title = t('Void invoice')
  let confirmText = t('Void')
  let ready = true
  if (props.action === 'issue') {
    title = t('Issue invoice')
    confirmText = t('Issue')
    ready = invoiceNo.trim() !== '' && file !== null && !fileTooLarge
  } else if (props.action === 'reject') {
    title = t('Reject application')
    confirmText = t('Reject')
    ready = reason.trim() !== ''
  }

  const summary = t('Application #{{id}}: {{title}}, {{amount}}', {
    id: invoice.id,
    title: invoice.title_name,
    amount: formatInvoiceAmount(invoice.amount_cents),
  })

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open && !run.isPending) props.onClose()
      }}
      title={title}
      desc={
        props.action === 'void'
          ? t(
              '{{summary}}. Void it only after it has been reversed with the tax authority. Its orders become available for a new application.',
              { summary }
            )
          : summary
      }
      destructive={props.action !== 'issue'}
      confirmText={confirmText}
      disabled={!ready}
      isLoading={run.isPending}
      handleConfirm={() => run.mutate()}
    >
      {invoice.remark && (
        <div className='rounded-lg border p-3 text-sm'>
          <p className='text-muted-foreground'>{t('Remark')}</p>
          <p className='break-words whitespace-pre-line'>{invoice.remark}</p>
        </div>
      )}
      {props.action === 'issue' && (
        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='invoice-issue-no'>{t('Invoice number')}</Label>
            <Input
              id='invoice-issue-no'
              className='font-mono'
              value={invoiceNo}
              maxLength={64}
              onChange={(event) => setInvoiceNo(event.target.value)}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='invoice-issue-file'>
              {t('Invoice PDF (at most {{max}} MB)', {
                max: MAX_INVOICE_FILE_MB,
              })}
            </Label>
            {/* No shared upload component exists; a native file input
                matches features/task-plugins/components/upload-dialog.tsx. */}
            <Input
              id='invoice-issue-file'
              type='file'
              accept='application/pdf,.pdf'
              aria-invalid={fileTooLarge}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            {fileTooLarge && (
              <p className='text-destructive text-sm' role='alert'>
                {t('The file is larger than {{max}} MB', {
                  max: MAX_INVOICE_FILE_MB,
                })}
              </p>
            )}
          </div>
        </div>
      )}
      {props.action === 'reject' && (
        <div className='space-y-2'>
          <Label htmlFor='invoice-reject-reason'>{t('Reject reason')}</Label>
          <Textarea
            id='invoice-reject-reason'
            value={reason}
            maxLength={200}
            onChange={(event) => setReason(event.target.value)}
          />
          <p className='text-muted-foreground text-sm'>
            {t('The user sees this reason and can apply again.')}
          </p>
        </div>
      )}
    </ConfirmDialog>
  )
}
