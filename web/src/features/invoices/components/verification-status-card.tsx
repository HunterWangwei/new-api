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
import { Link } from '@tanstack/react-router'
import { MessageSquarePlus, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

import {
  INVOICE_SUBJECT_TYPE_LABELS,
  VERIFICATION_STATUSES,
} from '../constants'
import type { InvoiceVerification } from '../types'

type VerificationStatusCardProps = {
  verification: InvoiceVerification | null
  onEdit: () => void
}

export function VerificationStatusCard(props: VerificationStatusCardProps) {
  const { t } = useTranslation()
  const verification = props.verification

  if (!verification) {
    return (
      <Alert>
        <ShieldCheck aria-hidden='true' />
        <AlertTitle>{t('Identity verification required')}</AlertTitle>
        <AlertDescription>
          {t(
            'Submit personal or company verification first. You can apply for invoices after customer service approves it.'
          )}
        </AlertDescription>
        <AlertAction>
          <Button size='sm' onClick={props.onEdit}>
            {t('Start verification')}
          </Button>
        </AlertAction>
      </Alert>
    )
  }

  const status = VERIFICATION_STATUSES[verification.status]
  return (
    <Alert
      variant={verification.status === 'rejected' ? 'destructive' : 'default'}
    >
      <ShieldCheck aria-hidden='true' />
      <AlertTitle className='flex flex-wrap items-center gap-2'>
        <span>
          {t(INVOICE_SUBJECT_TYPE_LABELS[verification.type])} ·{' '}
          {verification.name}
        </span>
        <StatusBadge
          label={t(status.labelKey)}
          variant={status.variant}
          copyable={false}
        />
      </AlertTitle>
      <AlertDescription className='space-y-1'>
        <p className='font-mono'>{verification.id_number}</p>
        {verification.status === 'pending' && (
          <>
            <p>
              {t(
                'Verification submitted and waiting for review. Submit a ticket if you need to add information.'
              )}
            </p>
            <Button
              size='sm'
              variant='outline'
              className='mt-1 gap-1.5'
              render={<Link to='/tickets' search={{ create: 'invoice' }} />}
            >
              <MessageSquarePlus className='size-4' aria-hidden='true' />
              {t('Submit ticket')}
            </Button>
          </>
        )}
        {verification.status === 'rejected' && (
          <p>
            {t('Reason: {{reason}}', { reason: verification.reject_reason })}
          </p>
        )}
        {verification.status === 'approved' && (
          <p>{t('Invoices are issued to this subject.')}</p>
        )}
      </AlertDescription>
      <AlertAction>
        <Button size='sm' variant='outline' onClick={props.onEdit}>
          {verification.status === 'rejected'
            ? t('Resubmit')
            : t('Edit verification')}
        </Button>
      </AlertAction>
    </Alert>
  )
}
