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
import type { ColumnDef } from '@tanstack/react-table'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { TruncatedCell } from '@/components/data-table'
import { StatusBadge } from '@/components/status-badge'
import { TableId } from '@/components/table-id'
import { formatTimestampToDate } from '@/lib/format'

import { INVOICE_STATUSES, INVOICE_SUBJECT_TYPE_LABELS } from '../constants'
import { formatInvoiceAmount } from '../lib/format'
import type { Invoice } from '../types'

type InvoiceColumnsOptions = {
  admin: boolean
  renderActions: (invoice: Invoice) => ReactNode
}

export function useInvoiceColumns(
  options: InvoiceColumnsOptions
): ColumnDef<Invoice>[] {
  const { t } = useTranslation()
  const columns: ColumnDef<Invoice>[] = [
    {
      accessorKey: 'id',
      header: t('ID'),
      meta: { mobileHidden: true },
      cell: ({ row }) => <TableId value={row.original.id} />,
      size: 80,
    },
  ]
  if (options.admin) {
    columns.push({
      accessorKey: 'user_id',
      header: t('User ID'),
      cell: ({ row }) => <TableId value={row.original.user_id} />,
      size: 90,
    })
  }
  columns.push(
    {
      accessorKey: 'title_name',
      header: t('Invoice title'),
      meta: { mobileTitle: true },
      cell: ({ row }) => (
        <div className='min-w-0'>
          <TruncatedCell className='font-medium'>
            {row.original.title_name}
          </TruncatedCell>
          <div className='text-muted-foreground text-xs'>
            {t(INVOICE_SUBJECT_TYPE_LABELS[row.original.title_type])}
            {row.original.tax_no ? ` · ${row.original.tax_no}` : ''}
          </div>
        </div>
      ),
      size: 240,
    },
    {
      accessorKey: 'amount_cents',
      header: t('Amount'),
      cell: ({ row }) => (
        <span className='font-mono'>
          {formatInvoiceAmount(row.original.amount_cents)}
        </span>
      ),
      size: 120,
    },
    {
      accessorKey: 'status',
      header: t('Status'),
      meta: { mobileBadge: true },
      cell: ({ row }) => {
        const config = INVOICE_STATUSES[row.original.status]
        if (!config) return null
        return (
          <div className='min-w-0'>
            <StatusBadge
              label={t(config.labelKey)}
              variant={config.variant}
              copyable={false}
              className='-ml-1.5'
            />
            {row.original.status === 'rejected' &&
              row.original.reject_reason && (
                <TruncatedCell className='text-muted-foreground text-xs'>
                  {row.original.reject_reason}
                </TruncatedCell>
              )}
          </div>
        )
      },
      size: 160,
    },
    {
      accessorKey: 'invoice_no',
      header: t('Invoice number'),
      cell: ({ row }) => (
        <span className='font-mono'>{row.original.invoice_no || '-'}</span>
      ),
      size: 200,
    },
    {
      accessorKey: 'trade_nos',
      header: t('Orders'),
      meta: { mobileHidden: true },
      cell: ({ row }) => {
        const tradeNos = row.original.trade_nos
          ? row.original.trade_nos.split(',')
          : []
        return (
          <TruncatedCell
            className='font-mono text-xs'
            tooltipContent={tradeNos.join(', ')}
          >
            {t('{{count}} orders', { count: tradeNos.length })}
          </TruncatedCell>
        )
      },
      size: 120,
    },
    {
      accessorKey: 'remark',
      header: t('Remark'),
      cell: ({ row }) =>
        row.original.remark ? (
          <TruncatedCell className='text-sm whitespace-pre-line'>
            {row.original.remark}
          </TruncatedCell>
        ) : (
          <span className='text-muted-foreground'>-</span>
        ),
      size: 200,
    },
    {
      accessorKey: 'created_time',
      header: t('Applied at'),
      meta: { mobileHidden: true },
      cell: ({ row }) => (
        <span className='font-mono text-sm'>
          {formatTimestampToDate(row.original.created_time)}
        </span>
      ),
      size: 180,
    },
    {
      id: 'actions',
      header: () => <span className='sr-only'>{t('Actions')}</span>,
      cell: ({ row }) => options.renderActions(row.original),
      enableSorting: false,
      enableHiding: false,
      size: 120,
    }
  )
  return columns
}
