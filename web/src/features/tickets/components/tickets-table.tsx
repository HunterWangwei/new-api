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
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DataTablePage,
  TruncatedCell,
  useDataTable,
} from '@/components/data-table'
import { StatusBadge } from '@/components/status-badge'
import { TableId } from '@/components/table-id'
import { Button } from '@/components/ui/button'
import { useMediaQuery } from '@/hooks'
import { type NavigateFn, useTableUrlState } from '@/hooks/use-table-url-state'
import { formatTimestampToDate } from '@/lib/format'
import {
  createServerError,
  translateServerText,
} from '@/lib/server-error-message'

import { getTickets } from '../api'
import {
  TICKET_STATUSES,
  getTicketStatusOptions,
  ticketQueryKeys,
} from '../constants'
import type { Ticket } from '../types'

type TicketsTableProps = {
  admin: boolean
  search: Record<string, unknown>
  navigate: NavigateFn
  categories: string[]
  onOpen: (ticket: Ticket) => void
  emptyAction?: ReactNode
}

export function TicketsTable(props: TicketsTableProps) {
  const { t } = useTranslation()
  const isMobile = useMediaQuery('(max-width: 640px)')
  const {
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search: props.search,
    navigate: props.navigate,
    pagination: { defaultPage: 1, defaultPageSize: isMobile ? 10 : 20 },
    globalFilter: { enabled: false },
    columnFilters: [
      { columnId: 'status', searchKey: 'status', type: 'array' },
      { columnId: 'category', searchKey: 'category', type: 'array' },
    ],
  })
  const firstFilterValue = (columnId: string) =>
    (
      columnFilters.find((filter) => filter.id === columnId)?.value as
        | string[]
        | undefined
    )?.[0] ?? ''
  const status = firstFilterValue('status')
  const category = props.admin ? firstFilterValue('category') : ''
  const page = pagination.pageIndex + 1

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ticketQueryKeys.list(
      props.admin,
      page,
      pagination.pageSize,
      status,
      category
    ),
    queryFn: async () => {
      const result = await getTickets(props.admin, {
        p: page,
        page_size: pagination.pageSize,
        status,
        category,
      })
      if (!result.success) {
        throw createServerError(result, t('Failed to load tickets'))
      }
      return {
        items: result.data?.items ?? [],
        total: result.data?.total ?? 0,
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const columns: ColumnDef<Ticket>[] = [
    {
      accessorKey: 'id',
      header: t('ID'),
      meta: { mobileHidden: true },
      cell: ({ row }) => <TableId value={row.original.id} />,
      size: 80,
    },
  ]
  if (props.admin) {
    columns.push({
      accessorKey: 'user_id',
      header: t('User ID'),
      cell: ({ row }) => <TableId value={row.original.user_id} />,
      size: 90,
    })
  }
  columns.push(
    {
      accessorKey: 'title',
      header: t('Title'),
      meta: { mobileTitle: true },
      cell: ({ row }) => (
        <TruncatedCell className='font-medium'>
          {row.original.title}
        </TruncatedCell>
      ),
      size: 280,
    },
    {
      accessorKey: 'category',
      header: t('Category'),
      cell: ({ row }) => translateServerText(t, row.original.category),
      size: 160,
    },
    {
      accessorKey: 'status',
      header: t('Status'),
      meta: { mobileBadge: true },
      cell: ({ row }) => {
        const config = TICKET_STATUSES[row.original.status]
        if (!config) return null
        return (
          <StatusBadge
            label={t(config.labelKey)}
            variant={config.variant}
            copyable={false}
            className='-ml-1.5'
          />
        )
      },
      size: 140,
    },
    {
      accessorKey: 'updated_time',
      header: t('Last updated'),
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
      cell: ({ row }) => (
        <Button
          variant='ghost'
          size='sm'
          onClick={() => props.onOpen(row.original)}
        >
          {t('View')}
        </Button>
      ),
      enableSorting: false,
      enableHiding: false,
      size: 90,
    }
  )

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

  const filters: {
    columnId: string
    title: string
    options: { label: string; value: string }[]
    singleSelect: boolean
  }[] = [
    {
      columnId: 'status',
      title: t('Status'),
      options: getTicketStatusOptions(t),
      singleSelect: true,
    },
  ]
  if (props.admin && props.categories.length > 0) {
    filters.push({
      columnId: 'category',
      title: t('Category'),
      options: props.categories.map((name) => ({
        label: translateServerText(t, name),
        value: name,
      })),
      singleSelect: true,
    })
  }

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={isLoading}
      isFetching={isFetching}
      emptyTitle={t('No tickets yet')}
      emptyDescription={
        props.admin
          ? t('Tickets submitted by users appear here.')
          : t('Open a ticket when you need help from customer service.')
      }
      emptyAction={props.emptyAction}
      skeletonKeyPrefix='tickets-skeleton'
      applyHeaderSize
      toolbarProps={{
        // The API filters by status and category only.
        customSearch: null,
        filters,
      }}
    />
  )
}
