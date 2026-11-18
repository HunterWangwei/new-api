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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { StaticDataTable } from '@/components/data-table'
import { Dialog } from '@/components/dialog'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { getPaymentMethodName } from '@/features/wallet/lib/billing'
import { formatTimestampToDate } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'
import {
  createServerError,
  requireServerSuccess,
} from '@/lib/server-error-message'

import { applyInvoice, getEligibleTopUps } from '../api'
import {
  INVOICE_SUBJECT_TYPE_LABELS,
  MAX_INVOICE_TOPUPS_PER_APPLY,
  invoiceQueryKeys,
} from '../constants'
import {
  formatInvoiceAmount,
  moneyToCents,
  sumSelectedCents,
} from '../lib/format'
import type { InvoiceVerification } from '../types'

type ApplyInvoiceDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The approved verification; its subject is the invoice title. */
  verification: InvoiceVerification
}

export function ApplyInvoiceDialog(props: ApplyInvoiceDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  // One application holds at most MAX_INVOICE_TOPUPS_PER_APPLY orders, so a
  // single page of that size lists everything that can be selected at once.
  const orders = useQuery({
    queryKey: invoiceQueryKeys.eligible(1, MAX_INVOICE_TOPUPS_PER_APPLY),
    queryFn: async () =>
      requireServerSuccess(
        await getEligibleTopUps(1, MAX_INVOICE_TOPUPS_PER_APPLY)
      ),
    enabled: props.open,
  })
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set())
  const [remark, setRemark] = useState('')

  const orderList = orders.data?.data?.items ?? []
  const totalOrders = orders.data?.data?.total ?? 0

  useEffect(() => {
    if (!props.open) {
      setSelected(new Set())
      setRemark('')
    }
  }, [props.open])

  const submit = useMutation({
    mutationFn: async () => {
      const result = await applyInvoice({
        top_up_ids: [...selected],
        remark,
      })
      if (!result.success) {
        throw createServerError(result, t('Failed to submit application'))
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: invoiceQueryKeys.all })
      toast.success(t('Invoice application submitted'))
      props.onOpenChange(false)
    },
    onError: async (error) => {
      handleServerError(error)
      // Another tab may have claimed some orders; show the current list.
      await queryClient.invalidateQueries({
        queryKey: invoiceQueryKeys.eligible(1, MAX_INVOICE_TOPUPS_PER_APPLY),
      })
      setSelected(new Set())
    },
  })

  const toggle = (id: number, checked: boolean) => {
    const next = new Set(selected)
    if (checked) next.add(id)
    else next.delete(id)
    setSelected(next)
  }
  const allSelected = orderList.length > 0 && selected.size === orderList.length
  const totalCents = sumSelectedCents(orderList, selected)
  const canSubmit = selected.size > 0 && !submit.isPending

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!submit.isPending) props.onOpenChange(open)
      }}
      title={t('Apply for invoice')}
      description={t(
        'Successful CNY top-ups from the last 12 months can be invoiced. Each order can be invoiced once.'
      )}
      contentClassName='sm:max-w-3xl'
      contentHeight='min(75vh, 720px)'
      footer={
        <div className='flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <p className='text-sm' aria-live='polite'>
            {t('{{count}} orders selected, total {{amount}}', {
              count: selected.size,
              amount: formatInvoiceAmount(totalCents),
            })}
          </p>
          <div className='flex justify-end gap-2'>
            <Button
              variant='outline'
              disabled={submit.isPending}
              onClick={() => props.onOpenChange(false)}
            >
              {t('Cancel')}
            </Button>
            <Button disabled={!canSubmit} onClick={() => submit.mutate()}>
              {submit.isPending ? t('Submitting...') : t('Submit')}
            </Button>
          </div>
        </div>
      }
    >
      <div className='space-y-4'>
        <div className='space-y-1 rounded-lg border p-3 text-sm'>
          <p className='text-muted-foreground'>{t('Invoice title')}</p>
          <p className='font-medium'>
            {t(INVOICE_SUBJECT_TYPE_LABELS[props.verification.type])} ·{' '}
            {props.verification.name}
          </p>
          {props.verification.type === 'company' && (
            <p className='font-mono'>{props.verification.id_number}</p>
          )}
        </div>

        {orders.isLoading && <LoadingState />}
        {orders.isError && (
          <ErrorState
            description={t('Failed to load orders')}
            onRetry={() => void orders.refetch()}
          />
        )}
        {orders.isSuccess && (
          <>
            {totalOrders > orderList.length && (
              <p className='text-muted-foreground text-sm'>
                {t(
                  'Showing the latest {{shown}} of {{total}} orders. Submit these first to invoice older ones.',
                  { shown: orderList.length, total: totalOrders }
                )}
              </p>
            )}
            <StaticDataTable
              tableClassName='min-w-[560px]'
              data={orderList}
              getRowKey={(order) => order.id}
              emptyContent={t('No orders available for invoicing')}
              columns={[
                {
                  id: 'select',
                  className: 'w-10',
                  header: (
                    <Checkbox
                      checked={allSelected}
                      indeterminate={selected.size > 0 && !allSelected}
                      disabled={orderList.length === 0}
                      onCheckedChange={(checked) =>
                        setSelected(
                          checked
                            ? new Set(orderList.map((order) => order.id))
                            : new Set()
                        )
                      }
                      aria-label={t('Select all')}
                    />
                  ),
                  cell: (order) => (
                    <Checkbox
                      checked={selected.has(order.id)}
                      onCheckedChange={(checked) =>
                        toggle(order.id, checked === true)
                      }
                      aria-label={t('Select order {{tradeNo}}', {
                        tradeNo: order.trade_no,
                      })}
                    />
                  ),
                },
                {
                  id: 'trade_no',
                  header: t('Order number'),
                  cellClassName: 'font-mono',
                  cell: (order) => order.trade_no,
                },
                {
                  id: 'method',
                  header: t('Payment method'),
                  cell: (order) =>
                    getPaymentMethodName(order.payment_method, t),
                },
                {
                  id: 'complete_time',
                  header: t('Paid at'),
                  cellClassName: 'font-mono',
                  cell: (order) => formatTimestampToDate(order.complete_time),
                },
                {
                  id: 'amount',
                  header: t('Amount'),
                  className: 'text-right',
                  cellClassName: 'text-right font-mono',
                  cell: (order) =>
                    formatInvoiceAmount(moneyToCents(order.money)),
                },
              ]}
            />
          </>
        )}

        <div className='space-y-2'>
          <Label htmlFor='invoice-apply-remark'>{t('Remark (optional)')}</Label>
          <Textarea
            id='invoice-apply-remark'
            value={remark}
            maxLength={200}
            onChange={(event) => setRemark(event.target.value)}
          />
        </div>
      </div>
    </Dialog>
  )
}
