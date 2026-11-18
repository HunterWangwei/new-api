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
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTablePage, useDataTable } from '@/components/data-table'
import { useMediaQuery } from '@/hooks'
import { type NavigateFn, useTableUrlState } from '@/hooks/use-table-url-state'
import { createServerError } from '@/lib/server-error-message'

import { getAllInvoices, getUserInvoices } from '../api'
import { getInvoiceStatusOptions, invoiceQueryKeys } from '../constants'
import type { Invoice } from '../types'
import { useInvoiceColumns } from './invoice-columns'

type InvoicesTableProps = {
  admin: boolean
  search: Record<string, unknown>
  navigate: NavigateFn
  renderActions: (invoice: Invoice) => ReactNode
  emptyAction?: ReactNode
}

export function InvoicesTable(props: InvoicesTableProps) {
  const { t } = useTranslation()
  const isMobile = useMediaQuery('(max-width: 640px)')
  const columns = useInvoiceColumns({
    admin: props.admin,
    renderActions: props.renderActions,
  })
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
    columnFilters: [{ columnId: 'status', searchKey: 'status', type: 'array' }],
  })
  const statusFilter =
    (columnFilters.find((filter) => filter.id === 'status')?.value as
      | string[]
      | undefined) ?? []
  const status = statusFilter[0] ?? ''
  const page = pagination.pageIndex + 1

  const { data, isLoading, isFetching } = useQuery({
    queryKey: props.admin
      ? invoiceQueryKeys.admin(page, pagination.pageSize, status)
      : invoiceQueryKeys.self(page, pagination.pageSize, status),
    queryFn: async () => {
      const params = { p: page, page_size: pagination.pageSize, status }
      const result = props.admin
        ? await getAllInvoices(params)
        : await getUserInvoices(params)
      if (!result.success) {
        throw createServerError(result, t('Failed to load invoices'))
      }
      return {
        items: result.data?.items ?? [],
        total: result.data?.total ?? 0,
      }
    },
    placeholderData: (previousData) => previousData,
  })

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
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={isLoading}
      isFetching={isFetching}
      emptyTitle={t('No invoices yet')}
      emptyDescription={
        props.admin
          ? t('Invoice applications from users appear here.')
          : t('Apply for an invoice for your CNY top-up orders.')
      }
      emptyAction={props.emptyAction}
      skeletonKeyPrefix='invoices-skeleton'
      applyHeaderSize
      toolbarProps={{
        // The API filters by status only, so there is no keyword search.
        customSearch: null,
        filters: [
          {
            columnId: 'status',
            title: t('Status'),
            options: getInvoiceStatusOptions(t),
            singleSelect: true,
          },
        ],
      }}
    />
  )
}
