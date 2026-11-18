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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { handleServerError } from '@/lib/handle-server-error'
import { createServerError } from '@/lib/server-error-message'

import { approveInvoiceVerification, rejectInvoiceVerification } from '../api'
import { INVOICE_SUBJECT_TYPE_LABELS, invoiceQueryKeys } from '../constants'
import type { InvoiceVerification } from '../types'

type VerificationReviewDialogProps = {
  approve: boolean
  verification: InvoiceVerification
  onClose: () => void
}

// Mounted once per selected action, so the reason starts empty.
export function VerificationReviewDialog(props: VerificationReviewDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')
  const verification = props.verification
  const revoking = !props.approve && verification.status === 'approved'

  const review = useMutation({
    mutationFn: async () => {
      const result = props.approve
        ? await approveInvoiceVerification(verification.id)
        : await rejectInvoiceVerification(verification.id, reason.trim())
      if (!result.success) {
        throw createServerError(result, t('Operation failed'))
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: invoiceQueryKeys.all })
      toast.success(t('Verification updated'))
      props.onClose()
    },
    onError: (error) => handleServerError(error),
  })

  let title = t('Approve verification')
  if (revoking) title = t('Revoke verification')
  else if (!props.approve) title = t('Reject verification')

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open && !review.isPending) props.onClose()
      }}
      title={title}
      desc={
        props.approve
          ? t(
              'Approve only after checking the documents. The user can then apply for invoices made out to this subject.'
            )
          : t(
              'The user sees the reason and can resubmit. Applications already submitted are not affected.'
            )
      }
      destructive={!props.approve}
      confirmText={props.approve ? t('Approve') : t('Reject')}
      disabled={!props.approve && reason.trim() === ''}
      isLoading={review.isPending}
      handleConfirm={() => review.mutate()}
    >
      <dl className='grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg border p-3 text-sm'>
        <dt className='text-muted-foreground'>{t('User ID')}</dt>
        <dd>{verification.user_id}</dd>
        <dt className='text-muted-foreground'>{t('Verification type')}</dt>
        <dd>{t(INVOICE_SUBJECT_TYPE_LABELS[verification.type])}</dd>
        <dt className='text-muted-foreground'>{t('Name')}</dt>
        <dd className='break-words'>{verification.name}</dd>
        <dt className='text-muted-foreground'>{t('Identity number')}</dt>
        <dd className='font-mono break-all'>{verification.id_number}</dd>
      </dl>
      {!props.approve && (
        <div className='space-y-2'>
          <Label htmlFor='invoice-verification-reason'>
            {t('Reject reason')}
          </Label>
          <Textarea
            id='invoice-verification-reason'
            value={reason}
            maxLength={200}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
      )}
    </ConfirmDialog>
  )
}
