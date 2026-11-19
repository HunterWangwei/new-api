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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  sideDrawerContentClassName,
  sideDrawerFooterClassName,
  sideDrawerHeaderClassName,
} from '@/components/drawer-layout'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { formatTimestampToDate } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'
import {
  createServerError,
  requireServerSuccess,
  translateServerText,
} from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

import { closeTicket, getTicket, replyTicket } from '../api'
import {
  MAX_TICKET_CONTENT_LENGTH,
  TICKET_CLOSED_BY_LABELS,
  TICKET_REOPEN_WINDOW_SECONDS,
  TICKET_STATUSES,
  ticketQueryKeys,
} from '../constants'
import type { Ticket, TicketMessage } from '../types'

type TicketDetailSheetProps = {
  /** The ticket to show; null closes the sheet. */
  ticketId: number | null
  admin: boolean
  onClose: () => void
}

export function TicketDetailSheet(props: TicketDetailSheetProps) {
  const { t } = useTranslation()
  return (
    <Sheet
      open={props.ticketId !== null}
      onOpenChange={(open) => {
        if (!open) props.onClose()
      }}
    >
      <SheetContent className={sideDrawerContentClassName('sm:max-w-2xl')}>
        {props.ticketId !== null ? (
          <TicketConversation
            key={props.ticketId}
            ticketId={props.ticketId}
            admin={props.admin}
          />
        ) : (
          <SheetTitle className='sr-only'>{t('Ticket')}</SheetTitle>
        )}
      </SheetContent>
    </Sheet>
  )
}

function messageAuthorLabel(
  message: TicketMessage,
  admin: boolean,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  if (message.internal) return t('Internal note')
  if (!message.is_admin) {
    return admin ? t('User #{{id}}', { id: message.author_id }) : t('You')
  }
  return admin
    ? t('Customer service #{{id}}', { id: message.author_id })
    : t('Customer service')
}

function canUserReply(ticket: Ticket, nowSeconds: number): boolean {
  if (ticket.status !== 'closed') return true
  return nowSeconds - ticket.closed_time <= TICKET_REOPEN_WINDOW_SECONDS
}

function TicketConversation(props: { ticketId: number; admin: boolean }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [content, setContent] = useState('')
  const [internal, setInternal] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const detailKey = ticketQueryKeys.detail(props.admin, props.ticketId)

  const detail = useQuery({
    queryKey: detailKey,
    queryFn: async () =>
      requireServerSuccess(await getTicket(props.admin, props.ticketId)),
    select: (response) => response.data,
  })

  const refreshLists = () =>
    queryClient.invalidateQueries({ queryKey: ticketQueryKeys.all })

  const reply = useMutation({
    mutationFn: async () => {
      const result = await replyTicket(
        props.admin,
        props.ticketId,
        content,
        internal
      )
      if (!result.success || !result.data) {
        throw createServerError(result, t('Failed to send reply'))
      }
      return result.data
    },
    onSuccess: async (data) => {
      queryClient.setQueryData(detailKey, { success: true, data })
      setContent('')
      setInternal(false)
      toast.success(internal ? t('Note added') : t('Reply sent'))
      await refreshLists()
    },
    onError: (error) => handleServerError(error),
  })

  const close = useMutation({
    mutationFn: async () => {
      const result = await closeTicket(props.admin, props.ticketId)
      if (!result.success) {
        throw createServerError(result, t('Failed to close ticket'))
      }
    },
    onSuccess: async () => {
      setConfirmClose(false)
      toast.success(t('Ticket closed'))
      await refreshLists()
    },
    onError: (error) => handleServerError(error),
  })

  if (detail.isLoading) {
    return (
      <>
        <SheetHeader className={sideDrawerHeaderClassName()}>
          <SheetTitle>{t('Ticket')}</SheetTitle>
        </SheetHeader>
        <LoadingState />
      </>
    )
  }
  if (detail.isError || !detail.data) {
    return (
      <>
        <SheetHeader className={sideDrawerHeaderClassName()}>
          <SheetTitle>{t('Ticket')}</SheetTitle>
        </SheetHeader>
        <ErrorState
          description={t('Failed to load ticket')}
          onRetry={() => void detail.refetch()}
        />
      </>
    )
  }

  const ticket = detail.data.ticket
  const messages = detail.data.messages ?? []
  const status = TICKET_STATUSES[ticket.status]
  const nowSeconds = Math.floor(Date.now() / 1000)
  const replyAllowed = props.admin || canUserReply(ticket, nowSeconds)
  const closed = ticket.status === 'closed'
  let replyHint = ''
  if (closed && !props.admin) {
    replyHint = replyAllowed
      ? t('This ticket is closed. Replying reopens it.')
      : t(
          'This ticket was closed more than 7 days ago. Open a new ticket instead.'
        )
  } else if (closed) {
    replyHint = t('This ticket is closed. A reply reopens it for the user.')
  }

  return (
    <>
      <SheetHeader className={sideDrawerHeaderClassName()}>
        <SheetTitle className='flex flex-wrap items-center gap-2 pr-8'>
          <span className='break-words'>
            #{ticket.id} {ticket.title}
          </span>
          <StatusBadge
            label={t(status.labelKey)}
            variant={status.variant}
            copyable={false}
          />
        </SheetTitle>
        <SheetDescription className='flex flex-wrap gap-x-4 gap-y-1'>
          <span>{translateServerText(t, ticket.category)}</span>
          {props.admin && (
            <span>{t('User ID: {{id}}', { id: ticket.user_id })}</span>
          )}
          {ticket.reference && (
            <span className='font-mono'>
              {t('Related: {{reference}}', { reference: ticket.reference })}
            </span>
          )}
          {closed && ticket.closed_by && (
            <span>{t(TICKET_CLOSED_BY_LABELS[ticket.closed_by])}</span>
          )}
        </SheetDescription>
      </SheetHeader>

      <ol
        className='flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 sm:px-6'
        aria-label={t('Conversation')}
      >
        {messages.map((message) => (
          <li
            key={message.id}
            className={cn(
              'max-w-[85%] rounded-lg border px-3 py-2',
              message.is_admin ? 'self-start' : 'self-end',
              message.is_admin && !message.internal && 'bg-muted',
              message.internal &&
                'border-dashed bg-amber-50 dark:bg-amber-950/30'
            )}
          >
            <div className='text-muted-foreground mb-1 flex gap-3 text-xs'>
              <span>{messageAuthorLabel(message, props.admin, t)}</span>
              <span className='font-mono'>
                {formatTimestampToDate(message.created_time)}
              </span>
            </div>
            <p className='text-sm break-words whitespace-pre-wrap'>
              {message.content}
            </p>
          </li>
        ))}
      </ol>

      <SheetFooter
        className={sideDrawerFooterClassName('flex flex-col sm:flex-col')}
      >
        {replyHint && (
          <p className='text-muted-foreground text-sm'>{replyHint}</p>
        )}
        {replyAllowed && (
          <>
            <Label htmlFor='ticket-reply' className='sr-only'>
              {t('Reply')}
            </Label>
            <Textarea
              id='ticket-reply'
              value={content}
              rows={3}
              maxLength={MAX_TICKET_CONTENT_LENGTH}
              placeholder={t('Write a reply')}
              onChange={(event) => setContent(event.target.value)}
            />
          </>
        )}
        <div className='flex flex-wrap items-center justify-between gap-2'>
          {props.admin ? (
            <Label className='flex items-center gap-2 text-sm font-normal'>
              <Checkbox
                checked={internal}
                onCheckedChange={(checked) => setInternal(checked === true)}
              />
              {t('Internal note (hidden from the user)')}
            </Label>
          ) : (
            <span />
          )}
          <div className='flex gap-2'>
            {!closed && (
              <Button
                variant='outline'
                disabled={close.isPending}
                onClick={() => setConfirmClose(true)}
              >
                {t('Close ticket')}
              </Button>
            )}
            {replyAllowed && (
              <Button
                disabled={content.trim() === '' || reply.isPending}
                onClick={() => reply.mutate()}
              >
                {reply.isPending ? t('Sending...') : t('Send')}
              </Button>
            )}
          </div>
        </div>
      </SheetFooter>

      <ConfirmDialog
        open={confirmClose}
        onOpenChange={(open) => {
          if (!close.isPending) setConfirmClose(open)
        }}
        title={t('Close ticket')}
        desc={
          props.admin
            ? t(
                'Close this ticket? The user can reopen it within 7 days by replying.'
              )
            : t(
                'Close this ticket? You can reopen it within 7 days by replying.'
              )
        }
        confirmText={t('Close ticket')}
        isLoading={close.isPending}
        handleConfirm={() => close.mutate()}
      />
    </>
  )
}
