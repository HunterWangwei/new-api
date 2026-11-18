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
import type { ColumnDef } from '@tanstack/react-table'
import { CheckCircle2, XCircle } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DataTablePage,
  DataTableRowActionMenu,
  TruncatedCell,
  useDataTable,
} from '@/components/data-table'
import { StatusBadge } from '@/components/status-badge'
import { TableId } from '@/components/table-id'
import {
  DropdownMenuItem,
  DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu'
import { useMediaQuery } from '@/hooks'
import { type NavigateFn, useTableUrlState } from '@/hooks/use-table-url-state'
import { formatTimestampToDate } from '@/lib/format'
import { createServerError } from '@/lib/server-error-message'

import { getInvoiceVerifications } from '../api'
import {
  INVOICE_SUBJECT_TYPE_LABELS,
  VERIFICATION_STATUSES,
  getVerificationStatusOptions,
  invoiceQueryKeys,
} from '../constants'
import type { InvoiceVerification } from '../types'
import { VerificationReviewDialog } from './verification-review-dialog'

type VerificationsTableProps = {
  search: Record<string, unknown>
  navigate: NavigateFn
}

export function VerificationsTable(props: VerificationsTableProps) {
  const { t } = useTranslation()
  const isMobile = useMediaQuery('(max-width: 640px)')
  const [selection, setSelection] = useState<{
    approve: boolean
    verification: InvoiceVerification
  } | null>(null)
  // Separate URL keys keep this list's paging apart from the invoice list on
  // the same page.
  const {
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search: props.search,
    navigate: props.navigate,
    pagination: {
      pageKey: 'vpage',
      pageSizeKey: 'vpageSize',
      defaultPage: 1,
      defaultPageSize: isMobile ? 10 : 20,
    },
    globalFilter: { enabled: false },
    columnFilters: [
      { columnId: 'status', searchKey: 'vstatus', type: 'array' },
    ],
  })
  const statusFilter =
    (columnFilters.find((filter) => filter.id === 'status')?.value as
      | string[]
      | undefined) ?? []
  const status = statusFilter[0] ?? ''
  const page = pagination.pageIndex + 1

  const { data, isLoading, isFetching } = useQuery({
    queryKey: invoiceQueryKeys.verifications(page, pagination.pageSize, status),
    queryFn: async () => {
      const result = await getInvoiceVerifications({
        p: page,
        page_size: pagination.pageSize,
        status,
      })
      if (!result.success) {
        throw createServerError(result, t('Failed to load verifications'))
      }
      return {
        items: result.data?.items ?? [],
        total: result.data?.total ?? 0,
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const columns: ColumnDef<InvoiceVerification>[] = [
    {
      accessorKey: 'user_id',
      header: t('User ID'),
      cell: ({ row }) => <TableId value={row.original.user_id} />,
      size: 90,
    },
    {
      accessorKey: 'name',
      header: t('Name'),
      meta: { mobileTitle: true },
      cell: ({ row }) => (
        <div className='min-w-0'>
          <TruncatedCell className='font-medium'>
            {row.original.name}
          </TruncatedCell>
          <div className='text-muted-foreground text-xs'>
            {t(INVOICE_SUBJECT_TYPE_LABELS[row.original.type])}
          </div>
        </div>
      ),
      size: 220,
    },
    {
      accessorKey: 'id_number',
      header: t('Identity number'),
      cell: ({ row }) => (
        <span className='font-mono'>{row.original.id_number}</span>
      ),
      size: 200,
    },
    {
      accessorKey: 'status',
      header: t('Status'),
      meta: { mobileBadge: true },
      cell: ({ row }) => {
        const config = VERIFICATION_STATUSES[row.original.status]
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
      accessorKey: 'email',
      header: t('Email'),
      meta: { mobileHidden: true },
      cell: ({ row }) => row.original.email || '-',
      size: 180,
    },
    {
      accessorKey: 'updated_time',
      header: t('Submitted at'),
      meta: { mobileHidden: true },
      cell: ({ row }) => (
        <span className='font-mono text-sm'>
          {formatTimestampToDate(row.original.updated_time)}
        </span>
      ),
      size: 180,
    },
    {
      id: 'actions',
      header: () => <span className='sr-only'>{t('Actions')}</span>,
      cell: ({ row }) => {
        const verification = row.original
        if (verification.status === 'rejected') return null
        return (
          <DataTableRowActionMenu ariaLabel={t('Open menu')} modal={false}>
            {verification.status === 'pending' && (
              <DropdownMenuItem
                onClick={() => setSelection({ approve: true, verification })}
              >
                {t('Approve')}
                <DropdownMenuShortcut>
                  <CheckCircle2 size={16} />
                </DropdownMenuShortcut>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className='text-destructive focus:text-destructive'
              onClick={() => setSelection({ approve: false, verification })}
            >
              {verification.status === 'approved' ? t('Revoke') : t('Reject')}
              <DropdownMenuShortcut>
                <XCircle size={16} />
              </DropdownMenuShortcut>
            </DropdownMenuItem>
          </DataTableRowActionMenu>
        )
      },
      enableSorting: false,
      enableHiding: false,
      size: 80,
    },
  ]

  const { table } = useDataTable({
    data: data?.items ?? [],
    columns,
    getRowId: (row) => String(row.id),
    columnFilters,
    pagination,
    onPaginationChange,
    onColumnFiltersChange,
    manualPagination: true,
    manualFiltering: true,
    totalCount: data?.total ?? 0,
    ensurePageInRange,
  })

  return (
    <>
      <DataTablePage
        table={table}
        columns={columns}
        isLoading={isLoading}
        isFetching={isFetching}
        emptyTitle={t('No verifications yet')}
        emptyDescription={t(
          'Identity verifications submitted by users appear here.'
        )}
        skeletonKeyPrefix='invoice-verifications-skeleton'
        applyHeaderSize
        toolbarProps={{
          customSearch: null,
          filters: [
            {
              columnId: 'status',
              title: t('Status'),
              options: getVerificationStatusOptions(t),
              singleSelect: true,
            },
          ],
        }}
      />
      {selection && (
        <VerificationReviewDialog
          key={`${selection.approve}-${selection.verification.id}`}
          approve={selection.approve}
          verification={selection.verification}
          onClose={() => setSelection(null)}
        />
      )}
    </>
  )
}
