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
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { handleServerError } from '@/lib/handle-server-error'
import {
  createServerError,
  translateServerText,
} from '@/lib/server-error-message'

import { createTicket } from '../api'
import {
  MAX_TICKET_CONTENT_LENGTH,
  MAX_TICKET_REFERENCE_LENGTH,
  MAX_TICKET_TITLE_LENGTH,
  ticketQueryKeys,
} from '../constants'
import { getTicketFormSchema, type TicketFormValues } from '../lib/ticket-form'
import type { Ticket } from '../types'

type CreateTicketDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: string[]
  /** Values to start from, e.g. when another page asks for a ticket. */
  preset?: Partial<TicketFormValues>
  onCreated: (ticket: Ticket) => void
}

export function CreateTicketDialog(props: CreateTicketDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const form = useForm<TicketFormValues>({
    resolver: zodResolver(getTicketFormSchema(t)),
    defaultValues: { category: '', title: '', reference: '', content: '' },
  })
  const preset = props.preset

  useEffect(() => {
    if (!props.open) return
    form.reset({
      category: '',
      title: '',
      reference: '',
      content: '',
      ...preset,
    })
  }, [props.open, preset, form])

  const create = useMutation({
    mutationFn: async (values: TicketFormValues) => {
      const result = await createTicket(values)
      if (!result.success || !result.data) {
        throw createServerError(result, t('Failed to submit ticket'))
      }
      return result.data
    },
    onSuccess: async (ticket) => {
      await queryClient.invalidateQueries({ queryKey: ticketQueryKeys.all })
      toast.success(t('Ticket submitted'))
      props.onOpenChange(false)
      props.onCreated(ticket)
    },
    onError: (error) => handleServerError(error),
  })

  const categoryItems = props.categories.map((name) => ({
    value: name,
    label: translateServerText(t, name),
  }))

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!create.isPending) props.onOpenChange(open)
      }}
      title={t('New ticket')}
      description={t(
        'Describe the problem in text. Customer service replies here and notifies you.'
      )}
      contentClassName='sm:max-w-xl'
      footer={
        <>
          <Button
            variant='outline'
            disabled={create.isPending}
            onClick={() => props.onOpenChange(false)}
          >
            {t('Cancel')}
          </Button>
          <Button
            type='submit'
            form='create-ticket-form'
            disabled={create.isPending}
          >
            {create.isPending ? t('Submitting...') : t('Submit')}
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form
          id='create-ticket-form'
          className='space-y-4'
          onSubmit={(event) =>
            void form.handleSubmit((values) => create.mutate(values))(event)
          }
        >
          <FormField
            control={form.control}
            name='category'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Category')}</FormLabel>
                <Select
                  items={categoryItems}
                  value={field.value || null}
                  onValueChange={(value) => field.onChange(value ?? '')}
                >
                  <FormControl>
                    <SelectTrigger className='w-full'>
                      <SelectValue placeholder={t('Choose a category')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      {categoryItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='title'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Title')}</FormLabel>
                <FormControl>
                  <Input {...field} maxLength={MAX_TICKET_TITLE_LENGTH} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='reference'
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t('Related order or request ID (optional)')}
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    className='font-mono'
                    maxLength={MAX_TICKET_REFERENCE_LENGTH}
                  />
                </FormControl>
                <FormDescription>
                  {t('Helps customer service find the record faster')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='content'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Description')}</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={6}
                    maxLength={MAX_TICKET_CONTENT_LENGTH}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </Dialog>
  )
}
