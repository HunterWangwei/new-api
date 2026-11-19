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
import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

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
import { Textarea } from '@/components/ui/textarea'
import {
  categoriesFromLines,
  parseCategories,
} from '@/features/tickets/lib/ticket-form'
import { translateServerText } from '@/lib/server-error-message'

import { SettingsForm } from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import { safeNumberFieldProps } from '../utils/numeric-field'

// Mirror setting/ticket_setting/config.go.
const MAX_CATEGORIES = 20
const MAX_CATEGORY_LENGTH = 30
const MAX_AUTO_CLOSE_DAYS = 90

type TicketSettingsSectionProps = {
  categories: string
  autoCloseDays: number
}

export function TicketSettingsSection(props: TicketSettingsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const schema = useMemo(
    () =>
      z.object({
        categories: z.string().superRefine((value, ctx) => {
          const names = categoriesFromLines(value)
          if (names.length === 0 || names.length > MAX_CATEGORIES) {
            ctx.addIssue({
              code: 'custom',
              message: t('Configure 1 to {{max}} ticket categories', {
                max: MAX_CATEGORIES,
              }),
            })
          }
          if (names.some((name) => name.length > MAX_CATEGORY_LENGTH)) {
            ctx.addIssue({
              code: 'custom',
              message: t(
                'Each category name can have at most {{max}} characters',
                {
                  max: MAX_CATEGORY_LENGTH,
                }
              ),
            })
          }
        }),
        autoCloseDays: z.number().int().min(0).max(MAX_AUTO_CLOSE_DAYS),
      }),
    [t]
  )
  type FormValues = z.infer<typeof schema>

  const savedCategories = parseCategories(props.categories)
  const defaultValues: FormValues = {
    categories: savedCategories.join('\n'),
    autoCloseDays: props.autoCloseDays,
  }
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  useEffect(() => {
    form.reset({
      categories: parseCategories(props.categories).join('\n'),
      autoCloseDays: props.autoCloseDays,
    })
  }, [props.categories, props.autoCloseDays, form])

  const onSubmit = async (values: FormValues) => {
    const categories = JSON.stringify(categoriesFromLines(values.categories))
    if (categories !== JSON.stringify(savedCategories)) {
      await updateOption.mutateAsync({
        key: 'ticket_setting.categories',
        value: categories,
      })
    }
    if (values.autoCloseDays !== props.autoCloseDays) {
      await updateOption.mutateAsync({
        key: 'ticket_setting.auto_close_days',
        value: values.autoCloseDays,
      })
    }
  }

  return (
    <SettingsSection title={t('Tickets')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
          />
          <FormField
            control={form.control}
            name='categories'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Ticket categories')}</FormLabel>
                <FormControl>
                  <Textarea {...field} rows={8} />
                </FormControl>
                <FormDescription>
                  {t(
                    'One category per line, shown in this order. Renaming a category does not change tickets already submitted.'
                  )}
                </FormDescription>
                {savedCategories.length > 0 && (
                  <FormDescription>
                    {t('Users currently see: {{names}}', {
                      names: savedCategories
                        .map((name) => translateServerText(t, name))
                        .join(' / '),
                    })}
                  </FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='autoCloseDays'
            render={({ field }) => (
              <FormItem className='max-w-xs'>
                <FormLabel>{t('Automatic closing (days)')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={0}
                    max={MAX_AUTO_CLOSE_DAYS}
                    step={1}
                    {...safeNumberFieldProps(field)}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Close a ticket when the user has not answered a support reply for this many days. 0 turns it off.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
