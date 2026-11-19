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
import { handleServerError } from '@/lib/handle-server-error'
import { createServerError } from '@/lib/server-error-message'

import { submitInvoiceVerification } from '../api'
import { INVOICE_SUBJECT_TYPE_LABELS, invoiceQueryKeys } from '../constants'
import {
  getVerificationFormSchema,
  verificationToFormValues,
  type VerificationFormValues,
} from '../lib/verification-form'
import type { InvoiceSubjectType, InvoiceVerification } from '../types'

type VerificationFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  verification: InvoiceVerification | null
}

const SUBJECT_TYPES: InvoiceSubjectType[] = ['company', 'personal']

export function VerificationFormDialog(props: VerificationFormDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const form = useForm<VerificationFormValues>({
    resolver: zodResolver(getVerificationFormSchema(t)),
    defaultValues: verificationToFormValues(props.verification),
  })

  useEffect(() => {
    if (props.open) form.reset(verificationToFormValues(props.verification))
  }, [props.open, props.verification, form])

  const submit = useMutation({
    mutationFn: async (values: VerificationFormValues) => {
      const result = await submitInvoiceVerification(values)
      if (!result.success) {
        throw createServerError(result, t('Failed to submit verification'))
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: invoiceQueryKeys.myVerification(),
      })
      toast.success(t('Verification submitted and waiting for review.'))
      props.onOpenChange(false)
    },
    onError: (error) => handleServerError(error),
  })

  const subjectType = form.watch('type')
  const typeItems = SUBJECT_TYPES.map((value) => ({
    value,
    label: t(INVOICE_SUBJECT_TYPE_LABELS[value]),
  }))

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!submit.isPending) props.onOpenChange(open)
      }}
      title={t('Identity verification')}
      description={t(
        'Invoices are issued to the verified subject only. Submitting puts the verification under manual review again.'
      )}
      contentClassName='sm:max-w-lg'
      footer={
        <>
          <Button
            variant='outline'
            disabled={submit.isPending}
            onClick={() => props.onOpenChange(false)}
          >
            {t('Cancel')}
          </Button>
          <Button
            type='submit'
            form='invoice-verification-form'
            disabled={submit.isPending}
          >
            {submit.isPending ? t('Submitting...') : t('Submit')}
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form
          id='invoice-verification-form'
          className='space-y-4'
          onSubmit={(event) =>
            void form.handleSubmit((values) => submit.mutate(values))(event)
          }
        >
          <FormField
            control={form.control}
            name='type'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Verification type')}</FormLabel>
                <Select
                  items={typeItems}
                  value={field.value}
                  onValueChange={(value) => {
                    if (value === 'company' || value === 'personal') {
                      field.onChange(value)
                    }
                  }}
                >
                  <FormControl>
                    <SelectTrigger className='w-full'>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      {typeItems.map((item) => (
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
            name='name'
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {subjectType === 'company'
                    ? t('Company name')
                    : t('Real name')}
                </FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='id_number'
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {subjectType === 'company'
                    ? t('Taxpayer identification number')
                    : t('Resident identity card number')}
                </FormLabel>
                <FormControl>
                  <Input {...field} className='font-mono uppercase' />
                </FormControl>
                <FormDescription>
                  {subjectType === 'company'
                    ? t('Usually the 18-character unified social credit code')
                    : t(
                        'Only administrators reviewing the verification see the full number'
                      )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='email'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Notification email (optional)')}</FormLabel>
                <FormControl>
                  <Input {...field} type='email' autoComplete='email' />
                </FormControl>
                <FormDescription>
                  {t(
                    'Results are sent here; leave empty to use your account email'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </Dialog>
  )
}
