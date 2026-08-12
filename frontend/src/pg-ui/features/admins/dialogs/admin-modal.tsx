import type { AdminFormValuesInput } from '@/pg-ui/features/admins/forms/admin-form'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/pg-ui/components/ui/accordion';
import { Button } from '@/pg-ui/components/ui/button';

import { DecimalInput } from '@/pg-ui/components/common/decimal-input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/pg-ui/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/pg-ui/components/ui/form';
import { Input } from '@/pg-ui/components/ui/input';
import { LoaderButton } from '@/pg-ui/components/ui/loader-button';
import { PasswordInput } from '@/pg-ui/components/ui/password-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/pg-ui/components/ui/select';

import { useAdmin } from '@/pg-ui/hooks/use-admin';
import useDynamicErrorHandler from '@/pg-ui/hooks/use-dynamic-errors'
import { useCreateAdmin, useGetRolesSimple, useModifyAdminById } from '@/pg-ui/service/api';
import type { RoleLimits } from '@/pg-ui/service/api'
import { upsertAdminInAdminsCache } from '@/pg-ui/utils/adminsCache';
import { removeAuthToken } from '@/pg-ui/utils/authStorage';
import { bytesToFormGigabytes, formatBytes, gbToBytes } from '@/pg-ui/utils/formatByte';
import { useQueryClient } from '@tanstack/react-query';
import { Pencil, Sliders, UserCog } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useWatch } from 'react-hook-form';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

const BUILTIN_ADMIN_ROLES = [
  { id: -2, name: 'administrator', is_owner: false },
  { id: -3, name: 'operator', is_owner: false },
]
const normalizeOverrideValue = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

const SECONDS_PER_DAY = 86_400

const normalizePermissionOverrides = (overrides: AdminFormValuesInput['permission_overrides']): RoleLimits => {
  const minDays = normalizeOverrideValue(overrides?.expire_days_min)
  const maxDays = normalizeOverrideValue(overrides?.expire_days_max)
  return {
    max_users: normalizeOverrideValue(overrides?.max_users),
    data_limit_min: normalizeOverrideValue(overrides?.data_limit_min),
    data_limit_max: normalizeOverrideValue(overrides?.data_limit_max),
    expire_min: minDays === null ? null : Math.round(minDays * SECONDS_PER_DAY),
    expire_max: maxDays === null ? null : Math.round(maxDays * SECONDS_PER_DAY),
    download_mbps_min: normalizeOverrideValue(overrides?.download_mbps_min),
    download_mbps_max: normalizeOverrideValue(overrides?.download_mbps_max),
    upload_mbps_min: normalizeOverrideValue(overrides?.upload_mbps_min),
    upload_mbps_max: normalizeOverrideValue(overrides?.upload_mbps_max),
    minDownloadMbps: normalizeOverrideValue(overrides?.download_mbps_min),
    maxDownloadMbps: normalizeOverrideValue(overrides?.download_mbps_max),
    minUploadMbps: normalizeOverrideValue(overrides?.upload_mbps_min),
    maxUploadMbps: normalizeOverrideValue(overrides?.upload_mbps_max),
  }
}

const normalizeDataLimit = (value: AdminFormValuesInput['data_limit']): number => {
  const normalized = normalizeOverrideValue(value)
  return normalized && normalized > 0 ? normalized : 0
}
const ONE_GB_IN_BYTES = 1024 * 1024 * 1024

interface AdminModalProps {
  isDialogOpen: boolean
  onOpenChange: (open: boolean) => void
  editingAdmin?: boolean
  editingAdminId?: number | null
  form: UseFormReturn<AdminFormValuesInput>
}

export default function AdminModal({ isDialogOpen, onOpenChange, editingAdminId, editingAdmin, form }: AdminModalProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const handleError = useDynamicErrorHandler()
  const queryClient = useQueryClient()
  const { admin: currentAdmin } = useAdmin()
  const addAdminMutation = useCreateAdmin()
  const modifyAdminMutation = useModifyAdminById()
  const rolesQuery = useGetRolesSimple()
  const selectedRoleId = form.watch('role_id')
  const roleOptions = useMemo(() => {
    const rolesByKey = new Map<string, { id: number; name: string; is_owner: boolean }>()

    const addRole = (role: { id: number; name: string; is_owner: boolean }) => {
      const key = role.name.trim().toLowerCase()
      const existing = rolesByKey.get(key)

      if (!existing || existing.id < 0) {
        rolesByKey.set(key, role)
      }
    }

    BUILTIN_ADMIN_ROLES.forEach(addRole)
    ;(rolesQuery.data?.roles || []).forEach(role => {
      if (!role.is_owner && role.id !== 1) {
        addRole(role)
      }
    })

    return Array.from(rolesByKey.values()).sort((a, b) => a.id - b.id)
  }, [rolesQuery.data?.roles])
  const selectedRoleExists = selectedRoleId == null || roleOptions.some(role => role.id === selectedRoleId)

  useEffect(() => {
    if (!isDialogOpen) {
      setOpenSection(undefined)
    }
  }, [isDialogOpen])

  // Accordion: only one section open at a time
  const [openSection, setOpenSection] = useState<string | undefined>(undefined)

  // Watch permission override fields
  const watchedPermissionOverrides = useWatch({ control: form.control, name: 'permission_overrides' })
  const permissionOverridesCount = useMemo(
    () => Object.values(watchedPermissionOverrides || {}).filter(value => value !== null && value !== undefined && value !== '').length,
    [watchedPermissionOverrides],
  )

  const handleAccordionChange = (value: string) => {
    setOpenSection(prev => (prev === value ? undefined : value))
  }

  // Ensure form is cleared when modal is closed
  const handleClose = (open: boolean) => {
    if (!open) {
      form.reset()
    }
    onOpenChange(open)
  }

  const onSubmit = async (values: AdminFormValuesInput) => {
    try {
      const passwordChanged = typeof values.password === 'string' && values.password.length > 0
      const isEditingCurrentAdmin = editingAdmin && currentAdmin != null && ((currentAdmin.id != null && editingAdminId === currentAdmin.id) || values.username === currentAdmin.username)
      const dataLimitChanged = !!form.formState.dirtyFields.data_limit
      const dataLimitHasValue = values.data_limit !== null && values.data_limit !== undefined && values.data_limit !== ''
      const dataLimitPayload = editingAdmin
        ? dataLimitChanged
          ? { data_limit: normalizeDataLimit(values.data_limit) }
          : {}
        : dataLimitHasValue
          ? { data_limit: normalizeDataLimit(values.data_limit) }
          : {}
      const editData = {
        password: values.password || undefined,
        ...(form.formState.dirtyFields.status ? { status: values.status || 'active' } : {}),
        ...dataLimitPayload,
        discord_webhook: values.discord_webhook,
        sub_domain: values.sub_domain,
        sub_template: values.sub_template,
        support_url: values.support_url,
        telegram_id: values.telegram_id,
        profile_title: values.profile_title,
        note: values.note,
        notification_enable: values.notification_enable || null,
        role_id: values.role_id,
        permission_overrides: normalizePermissionOverrides(values.permission_overrides),
      }
      if (editingAdmin && editingAdminId != null) {
        const updatedAdmin = await modifyAdminMutation.mutateAsync({
          adminId: editingAdminId,
          data: editData,
        })
        upsertAdminInAdminsCache(queryClient, updatedAdmin, { allowInsert: true })
        if (passwordChanged && isEditingCurrentAdmin) {
          toast.success(t('admins.passwordChangedTitle', { defaultValue: 'Password changed' }), {
            description: t('admins.passwordChangedLogout', { defaultValue: 'Please sign in again with your new password.' }),
          })
          onOpenChange(false)
          form.reset()
          await queryClient.cancelQueries()
          removeAuthToken()
          queryClient.clear()
          navigate('/login', { replace: true })
          return
        }
        toast.success(
          t('admins.editSuccess', {
            name: values.username,
            defaultValue: 'Admin «{name}» has been updated successfully',
          }),
        )
      } else {
        if (!values.password || values.password.length < 8) {
          form.setError('password', {
            type: 'manual',
            message: t('admins.passwordMinError', { defaultValue: 'Password must be at least 8 characters.' }),
          })
          return
        }
        const createData = {
          username: values.username,
          password: values.password, // Ensure password is present
          status: values.status || 'active',
          ...dataLimitPayload,
          discord_webhook: values.discord_webhook,
          sub_domain: values.sub_domain,
          sub_template: values.sub_template,
          support_url: values.support_url,
          telegram_id: values.telegram_id,
          profile_title: values.profile_title,
          note: values.note,
          notification_enable: values.notification_enable || null,
          role_id: values.role_id,
          permission_overrides: normalizePermissionOverrides(values.permission_overrides),
        }
        const createdAdmin = await addAdminMutation.mutateAsync({
          data: createData,
        })
        upsertAdminInAdminsCache(queryClient, createdAdmin, { allowInsert: true })
        toast.success(
          t('admins.createSuccess', {
            name: values.username,
            defaultValue: 'Admin «{name}» has been created successfully',
          }),
        )
      }
      onOpenChange(false)
      form.reset()
    } catch (error: any) {
      const fields = [
        'username',
        'password',
        'passwordConfirm',
        'role_id',
        'status',
        'data_limit',
        'discord_webhook',
        'sub_domain',
        'sub_template',
        'support_url',
        'telegram_id',
        'profile_title',
        'note',
        'permission_overrides',
      ]
      handleError({ error, fields, form, contextKey: 'admins' })
    }
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={handleClose}>
      <DialogContent className="h-auto max-w-[640px]" onOpenAutoFocus={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editingAdmin ? <Pencil className="h-5 w-5" /> : <UserCog className="h-5 w-5" />}
            <span>{editingAdmin ? t('admins.editAdmin') : t('admins.createAdmin')}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">{t('admins.description', { defaultValue: 'Configure admin account settings.' })}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" autoComplete="off">
            <div className="-mr-4 max-h-[75dvh] space-y-4 overflow-y-auto px-2 pr-4 sm:max-h-[70dvh]">
              {/* Essentials: always visible */}
              <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => {
                    const hasError = !!form.formState.errors.username
                    return (
                      <FormItem>
                        <FormLabel>{t('admins.username')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('admins.enterUsername')} disabled={editingAdmin} isError={hasError} autoComplete="off" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )
                  }}
                />
                <FormField
                  control={form.control}
                  name="role_id"
                  render={({ field }) => {
                    const isOwnerAdmin = editingAdmin && selectedRoleId === 1
                    return (
                      <FormItem>
                        <FormLabel>{t('admins.role')}</FormLabel>
                        <Select value={field.value?.toString() || '3'} onValueChange={value => field.onChange(Number(value))} disabled={isOwnerAdmin}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('admins.role')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {isOwnerAdmin && (
                              <SelectItem value="1" disabled>
                                {t('adminRoles.names.owner', { defaultValue: 'Owner' })}
                              </SelectItem>
                            )}
                            {!selectedRoleExists && !isOwnerAdmin && selectedRoleId != null && (
                              <SelectItem value={String(selectedRoleId)} disabled>
                                {t('adminRoles.currentRoleUnavailable', { defaultValue: 'Current role unavailable' })}
                              </SelectItem>
                            )}
                            {roleOptions.map(role => (
                              <SelectItem key={role.id} value={role.id.toString()}>
                                {t(`adminRoles.names.${role.name}`, { defaultValue: role.name })}
                              </SelectItem>
                            ))}
                            {rolesQuery.isLoading && (
                              <SelectItem value="loading" disabled>
                                {t('loading', { defaultValue: 'Loading...' })}
                              </SelectItem>
                            )}
                            {rolesQuery.isError && (
                              <SelectItem value="roles-error" disabled>
                                {t('adminRoles.loadFallback', { defaultValue: 'Using built-in roles' })}
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )
                  }}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => {
                    const hasError = !!form.formState.errors.password
                    return (
                      <FormItem>
                        <FormLabel>{t('admins.password')}</FormLabel>
                        <FormControl>
                          <PasswordInput
                            placeholder={t('admins.enterPassword')}
                            isError={hasError || (!editingAdmin && !!field.value && field.value.length < 8)}
                            autoComplete="new-password"
                            {...field}
                          />
                        </FormControl>
                        {!editingAdmin && !!field.value && field.value.length < 8 && (
                          <p className="text-destructive text-xs leading-5" role="alert">
                            {t('admins.passwordMinError', { defaultValue: 'Password must be at least 8 characters.' })}
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )
                  }}
                />
                <FormField
                  control={form.control}
                  name="passwordConfirm"
                  render={({ field }) => {
                    const hasError = !!form.formState.errors.passwordConfirm
                    return (
                      <FormItem>
                        <FormLabel>{t('admins.passwordConfirm')}</FormLabel>
                        <FormControl>
                          <PasswordInput placeholder={t('admins.enterPasswordConfirm')} isError={hasError} autoComplete="new-password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )
                  }}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('status', { defaultValue: 'Status' })}</FormLabel>
                      <Select value={field.value || 'active'} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('status', { defaultValue: 'Status' })} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">{t('status.active', { defaultValue: 'Active' })}</SelectItem>
                          {editingAdmin && <SelectItem value="disabled">{t('status.disabled', { defaultValue: 'Disabled' })}</SelectItem>}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <AdminDataLimitField form={form} />
              </div>

              {/* Advanced settings: collapsed by default */}
              <Accordion type="single" collapsible value={openSection} onValueChange={handleAccordionChange} className="!mt-0 flex w-full flex-col gap-y-3">

                <AccordionItem className="rounded-md border px-4 [&_[data-state=closed]]:no-underline [&_[data-state=open]]:no-underline" value="overrides">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <Sliders className="h-4 w-4" />
                      <span>{t('admins.permissionOverrides', { defaultValue: 'Permission overrides' })}</span>
                      <span className="text-muted-foreground text-xs">{permissionOverridesCount}/9</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-1 pt-1">
                    <p className="text-muted-foreground mb-3 text-xs">
                      {t('admins.permissionOverridesHint', { defaultValue: 'Leave empty to inherit limits from the selected role. Set to 0 to disable.' })}
                    </p>
                    <PermissionOverridesFields form={form} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('cancel')}
              </Button>
              <LoaderButton type="submit" isLoading={addAdminMutation.isPending || modifyAdminMutation.isPending} loadingText={editingAdmin ? t('modifying') : t('creating')}>
                {editingAdmin ? t('modify') : t('create')}
              </LoaderButton>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

type AdminForm = UseFormReturn<AdminFormValuesInput>

function PermissionOverridesFields({ form }: { form: AdminForm }) {
  const { t } = useTranslation()

  return (
    <div className="space-y-3">
      <FormField
        control={form.control}
        name="permission_overrides.max_users"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs">{t('adminRoles.limitFields.max_users', { defaultValue: 'Max users' })}</FormLabel>
            <FormControl>
              <DecimalInput
                placeholder={t('adminRoles.unlimited', { defaultValue: 'Unlimited' })}
                value={typeof field.value === 'number' ? field.value : null}
                emptyValue={null as any}
                zeroValue={0}
                onValueChange={value => field.onChange(value ?? null)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <BytesLimitField form={form} name="permission_overrides.data_limit_min" labelKey="adminRoles.limitFields.data_limit_min" />
        <BytesLimitField form={form} name="permission_overrides.data_limit_max" labelKey="adminRoles.limitFields.data_limit_max" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <NumberLimitField form={form} name="permission_overrides.expire_days_min" labelKey="adminRoles.limitFields.expire_days_min" />
        <NumberLimitField form={form} name="permission_overrides.expire_days_max" labelKey="adminRoles.limitFields.expire_days_max" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <NumberLimitField form={form} name="permission_overrides.download_mbps_min" labelKey="adminRoles.limitFields.download_mbps_min" />
        <NumberLimitField form={form} name="permission_overrides.download_mbps_max" labelKey="adminRoles.limitFields.download_mbps_max" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <NumberLimitField form={form} name="permission_overrides.upload_mbps_min" labelKey="adminRoles.limitFields.upload_mbps_min" />
        <NumberLimitField form={form} name="permission_overrides.upload_mbps_max" labelKey="adminRoles.limitFields.upload_mbps_max" />
      </div>
    </div>
  )
}

function AdminDataLimitField({ form }: { form: AdminForm }) {
  const { t } = useTranslation()

  return (
    <FormField
      control={form.control}
      name="data_limit"
      render={({ field }) => {
        const numericValue = typeof field.value === 'number' ? field.value : null
        return (
          <FormItem className="relative">
            <FormLabel>{t('admins.dataLimit', { defaultValue: 'Admin data limit' })}</FormLabel>
            <FormControl>
              <div className="relative">
                <DecimalInput
                  placeholder={t('adminRoles.unlimited', { defaultValue: 'Unlimited' })}
                  value={numericValue == null ? null : bytesToFormGigabytes(numericValue)}
                  onValueChange={value => {
                    if (value == null) {
                      field.onChange(null)
                      return
                    }
                    field.onChange(gbToBytes(value))
                  }}
                  emptyValue={undefined}
                  className="pr-10"
                />
                <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-medium">{t('userDialog.gb', { defaultValue: 'GB' })}</span>
              </div>
            </FormControl>
            {numericValue != null && numericValue > 0 && numericValue < ONE_GB_IN_BYTES && (
              <p dir="ltr" className="text-muted-foreground mt-1 w-full text-end text-[11px]">
                {formatBytes(numericValue)}
              </p>
            )}
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}

function NumberLimitField({ form, name, labelKey }: { form: AdminForm; name: any; labelKey: string }) {
  const { t } = useTranslation()
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs">{t(labelKey)}</FormLabel>
          <FormControl>
            <DecimalInput
              placeholder={t('adminRoles.unlimited', { defaultValue: 'Unlimited' })}
              value={typeof field.value === 'number' ? field.value : null}
              emptyValue={null as any}
              zeroValue={0}
              onValueChange={value => field.onChange(value ?? null)}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function BytesLimitField({ form, name, labelKey }: { form: AdminForm; name: any; labelKey: string }) {
  const { t } = useTranslation()
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => {
        const numericValue = typeof field.value === 'number' ? field.value : null
        return (
          <FormItem className="relative">
            <FormLabel className="text-xs">{t(labelKey)}</FormLabel>
            <FormControl>
              <div className="relative">
                <DecimalInput
                  placeholder={t('adminRoles.unlimited', { defaultValue: 'Unlimited' })}
                  value={numericValue == null ? null : bytesToFormGigabytes(numericValue)}
                  onValueChange={value => {
                    if (value == null) {
                      field.onChange(null)
                      return
                    }
                    field.onChange(gbToBytes(value))
                  }}
                  emptyValue={undefined}
                  className="pr-10"
                />
                <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-medium">{t('userDialog.gb', { defaultValue: 'GB' })}</span>
              </div>
            </FormControl>
            {numericValue != null && numericValue > 0 && numericValue < ONE_GB_IN_BYTES && (
              <p dir="ltr" className="text-muted-foreground mt-1 w-full text-end text-[11px]">
                {formatBytes(numericValue)}
              </p>
            )}
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}
