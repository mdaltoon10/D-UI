import { z } from 'zod';
import type { AdminRoleResponse, HWIDSettings, RoleAccess, RoleFeatures, RoleLimits, RolePermissions } from '@/pg-ui/service/api'

export type RoleScope = 0 | 1 | 2
type RolePermissionFormValue = boolean | { scope: RoleScope }
type RolePermissionFormMap = Record<string, Record<string, RolePermissionFormValue>>
type RolePermissionInput = object | null | undefined

export type RoleHwidPolicy = HWIDSettings

export type HwidMode = 'disabled' | 'use_global' | 'override'

export type PermissionAction = {
  resource: string
  action: string
  scoped?: boolean
}

export type PermissionGroup = {
  labelKey: string
  actions: PermissionAction[]
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    labelKey: 'inbounds',
    actions: [
      { resource: 'inbounds', action: 'read' },
      { resource: 'inbounds', action: 'read_simple' },
      { resource: 'inbounds', action: 'create' },
      { resource: 'inbounds', action: 'update' },
      { resource: 'inbounds', action: 'delete' },
      { resource: 'inbounds', action: 'reset_usage' },
    ],
  },
  {
    labelKey: 'clients',
    actions: [
      { resource: 'users', action: 'read', scoped: true },
      { resource: 'users', action: 'read_simple', scoped: true },
      { resource: 'users', action: 'create' },
      { resource: 'users', action: 'update', scoped: true },
      { resource: 'users', action: 'delete', scoped: true },
      { resource: 'users', action: 'reset_usage', scoped: true },
      { resource: 'users', action: 'revoke_sub', scoped: true },
      { resource: 'users', action: 'set_owner', scoped: true },
      { resource: 'users', action: 'activate_next_plan', scoped: true },
      { resource: 'users', action: 'admin_filter' },
    ],
  },
  {
    labelKey: 'groups',
    actions: [
      { resource: 'groups', action: 'read' },
      { resource: 'groups', action: 'read_simple' },
      { resource: 'groups', action: 'create' },
      { resource: 'groups', action: 'update' },
      { resource: 'groups', action: 'delete' },
    ],
  },
  {
    labelKey: 'nodes',
    actions: [
      { resource: 'nodes', action: 'read' },
      { resource: 'nodes', action: 'read_simple' },
      { resource: 'nodes', action: 'create' },
      { resource: 'nodes', action: 'update' },
      { resource: 'nodes', action: 'delete' },
      { resource: 'nodes', action: 'reconnect' },
      { resource: 'nodes', action: 'update_core' },
      { resource: 'nodes', action: 'stats' },
      { resource: 'nodes', action: 'logs' },
    ],
  },
  {
    labelKey: 'admins',
    actions: [
      { resource: 'admins', action: 'read' },
      { resource: 'admins', action: 'read_simple' },
      { resource: 'admins', action: 'create' },
      { resource: 'admins', action: 'update' },
      { resource: 'admins', action: 'delete' },
      { resource: 'admins', action: 'reset_usage' },
    ],
  },
  {
    labelKey: 'roles',
    actions: [
      { resource: 'admin_roles', action: 'read' },
      { resource: 'admin_roles', action: 'read_simple' },
      { resource: 'admin_roles', action: 'create' },
      { resource: 'admin_roles', action: 'update' },
      { resource: 'admin_roles', action: 'delete' },
    ],
  },
  {
    labelKey: 'outbounds',
    actions: [
      { resource: 'outbounds', action: 'read' },
      { resource: 'outbounds', action: 'create' },
      { resource: 'outbounds', action: 'update' },
      { resource: 'outbounds', action: 'delete' },
    ],
  },
  {
    labelKey: 'routing',
    actions: [
      { resource: 'routing', action: 'read' },
      { resource: 'routing', action: 'create' },
      { resource: 'routing', action: 'update' },
      { resource: 'routing', action: 'delete' },
    ],
  },
  {
    labelKey: 'settings',
    actions: [
      { resource: 'settings', action: 'read' },
      { resource: 'settings', action: 'read_general' },
      { resource: 'settings', action: 'update' },
    ],
  },
  {
    labelKey: 'xrayConfigs',
    actions: [
      { resource: 'cores', action: 'read' },
      { resource: 'cores', action: 'read_simple' },
      { resource: 'cores', action: 'create' },
      { resource: 'cores', action: 'update' },
      { resource: 'cores', action: 'delete' },
      { resource: 'hosts', action: 'read' },
      { resource: 'hosts', action: 'create' },
      { resource: 'hosts', action: 'update' },
    ],
  },
  {
    labelKey: 'overview',
    actions: [
      { resource: 'system', action: 'read' },
    ],
  },
]

export const LIMIT_KEYS = ['max_users', 'data_limit_min', 'data_limit_max', 'expire_days_min', 'expire_days_max', 'download_mbps_min', 'download_mbps_max', 'upload_mbps_min', 'upload_mbps_max'] as const

export const FEATURE_KEYS = ['can_use_reset_strategy', 'can_use_next_plan'] as const

function roleFeatureBool(features: unknown, key: string, fallback: boolean): boolean {
  if (!features || typeof features !== 'object') return fallback

  const value = (features as Record<string, unknown>)[key]
  if (typeof value === 'boolean') return value

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', 'yes', '1', 'on', 'enabled', 'all'].includes(normalized)) return true
    if (['false', 'no', '0', 'off', 'disabled', 'none'].includes(normalized)) return false
  }

  if (typeof value === 'number') return value !== 0
  return fallback
}

const VALID_PERMISSION_ACTIONS = PERMISSION_GROUPS.reduce<Record<string, Set<string>>>((acc, group) => {
  for (const item of group.actions) {
    acc[item.resource] = acc[item.resource] || new Set()
    acc[item.resource].add(item.action)
  }
  return acc
}, {})

const normalizePermissionValue = (value: unknown): RolePermissionFormValue | undefined => {
  if (typeof value === 'boolean') return value
  if (!value || typeof value !== 'object') return undefined

  const rawScope = (value as { scope?: unknown }).scope
  const scope = typeof rawScope === 'string' ? Number(rawScope) : rawScope
  if (scope === 0 || scope === 1 || scope === 2) return { scope }

  return undefined
}

const sanitizeRolePermissions = (permissions: RolePermissionInput): RolePermissionFormMap => {
  const next: RolePermissionFormMap = {}

  for (const [resource, actions] of Object.entries(permissions || {})) {
    const allowedActions = VALID_PERMISSION_ACTIONS[resource]
    if (!allowedActions || !actions || typeof actions !== 'object') continue

    for (const [action, value] of Object.entries(actions as Record<string, boolean | { scope: RoleScope }>)) {
      if (!allowedActions.has(action)) continue
      const normalizedValue = normalizePermissionValue(value)
      if (normalizedValue === undefined) continue
      next[resource] = { ...(next[resource] || {}), [action]: normalizedValue }
    }
  }

  return next
}

const buildOwnerRolePermissions = (): RolePermissionFormMap => {
  const next: RolePermissionFormMap = {}

  for (const group of PERMISSION_GROUPS) {
    for (const item of group.actions) {
      next[item.resource] = {
        ...(next[item.resource] || {}),
        [item.action]: item.scoped ? { scope: 2 as RoleScope } : true,
      }
    }
  }

  return next
}

const scopeSchema = z.object({ scope: z.union([z.literal(0), z.literal(1), z.literal(2)]) })
const permissionValueSchema = z.union([z.boolean(), scopeSchema])
const resourcePermissionsSchema = z.record(z.string(), permissionValueSchema)
const permissionsSchema = z.preprocess(value => sanitizeRolePermissions(value as RolePermissionInput), z.record(z.string(), resourcePermissionsSchema))

const optionalNullableNumber = z.union([z.number(), z.string().transform(v => (v === '' ? null : Number(v)))]).nullable().optional()

const limitsSchema = z.object({
  max_users: optionalNullableNumber,
  data_limit_min: optionalNullableNumber,
  data_limit_max: optionalNullableNumber,
  expire_days_min: optionalNullableNumber,
  expire_days_max: optionalNullableNumber,
  download_mbps_min: optionalNullableNumber,
  download_mbps_max: optionalNullableNumber,
  upload_mbps_min: optionalNullableNumber,
  upload_mbps_max: optionalNullableNumber,
})

const SECONDS_PER_DAY = 86_400

const toFiniteNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

const secondsToDays = (value: unknown): number | null => {
  const n = toFiniteNumberOrNull(value)
  return n === null ? null : Math.round(n / SECONDS_PER_DAY)
}

const normalizeHwidMode = (value: unknown): HwidMode => (
  value === 'disabled' || value === 'override' || value === 'use_global' ? value : 'use_global'
)

const booleanValue = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', 'yes', '1', 'on', 'enabled'].includes(normalized)) return true
    if (['false', 'no', '0', 'off', 'disabled'].includes(normalized)) return false
  }
  if (typeof value === 'number') return value !== 0
  return fallback
}

const daysToSeconds = (value: number | null | undefined): number | null => {
  if (value === null || value === undefined || value === ('' as unknown)) return null
  const n = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(n)) return null
  return Math.round(n * SECONDS_PER_DAY)
}

const hasValue = (_keyValue: [string, number | null | undefined]) => {
  const [, value] = _keyValue
  return value !== null && value !== undefined
}

const featuresSchema = z.object({
  can_use_reset_strategy: z.boolean(),
  can_use_next_plan: z.boolean(),
})

const accessSchema = z.object({
  allowed_inbound_ids: z.array(z.number().int().positive()).nullable(),
})

const hwidPolicySchema = z
  .object({
    mode: z.enum(['disabled', 'use_global', 'override']),
    enabled: z.boolean(),
    forced: z.boolean(),
    fallback_limit: optionalNullableNumber,
    min_limit: optionalNullableNumber,
    max_limit: optionalNullableNumber,
  })
  .superRefine((data, ctx) => {
    if (data.min_limit != null && data.max_limit != null && data.max_limit > 0 && data.min_limit > data.max_limit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'settings.hwid.validation.minMax',
        path: ['min_limit'],
      })
    }
  })

// Admin role form schema for validation and default values
export const adminRoleFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(64),
  permissions: permissionsSchema,
  limits: limitsSchema,
  features: featuresSchema,
  access: accessSchema,
  hwid: hwidPolicySchema,
  disabled_when_limited: z.boolean(),
  disconnect_users_when_limited: z.boolean(),
  disconnect_users_when_disabled: z.boolean(),
})

export type AdminRoleFormValuesInput = z.input<typeof adminRoleFormSchema>
export type AdminRoleFormValues = z.infer<typeof adminRoleFormSchema>

export const defaultAdminRoleFeatures = (): AdminRoleFormValues['features'] => ({
  can_use_reset_strategy: true,
  can_use_next_plan: true,
})

export const defaultAdminRoleAccess = (): AdminRoleFormValues['access'] => ({
  allowed_inbound_ids: null,
})

export const defaultAdminRoleHwid = (): AdminRoleFormValues['hwid'] => ({
  mode: 'use_global',
  enabled: true,
  forced: false,
  fallback_limit: null,
  min_limit: null,
  max_limit: null,
})

export const adminRoleFormDefaultValues: AdminRoleFormValuesInput = {
  name: '',
  permissions: {},
  limits: {
    max_users: null,
    data_limit_min: null,
    data_limit_max: null,
    expire_days_min: null,
    expire_days_max: null,
    download_mbps_min: null,
    download_mbps_max: null,
    upload_mbps_min: null,
    upload_mbps_max: null,
  },
  features: defaultAdminRoleFeatures(),
  access: defaultAdminRoleAccess(),
  hwid: defaultAdminRoleHwid(),
  disabled_when_limited: false,
  disconnect_users_when_limited: true,
  disconnect_users_when_disabled: true,
}

export const adminRoleFormFromResponse = (role: AdminRoleResponse): AdminRoleFormValuesInput => ({
  name: role.name,
  permissions: role.is_owner ? buildOwnerRolePermissions() : sanitizeRolePermissions(role.permissions),
  limits: {
    max_users: role.limits?.max_users ?? null,
    data_limit_min: role.limits?.data_limit_min ?? null,
    data_limit_max: role.limits?.data_limit_max ?? null,
    expire_days_min: secondsToDays(role.limits?.expire_min),
    expire_days_max: secondsToDays(role.limits?.expire_max),
    download_mbps_min: role.limits?.download_mbps_min ?? role.limits?.minDownloadMbps ?? null,
    download_mbps_max: role.limits?.download_mbps_max ?? role.limits?.maxDownloadMbps ?? null,
    upload_mbps_min: role.limits?.upload_mbps_min ?? role.limits?.minUploadMbps ?? null,
    upload_mbps_max: role.limits?.upload_mbps_max ?? role.limits?.maxUploadMbps ?? null,
  },
  features: {
    can_use_reset_strategy: role.features?.can_use_reset_strategy ?? true,
    can_use_next_plan: role.features?.can_use_next_plan ?? true,
  },
  access: {
    allowed_inbound_ids: role.access?.allowed_inbound_ids ?? null,
  },
  hwid: {
    mode: normalizeHwidMode(role.hwid?.mode),
    enabled: role.hwid?.enabled ?? true,
    forced: role.hwid?.forced ?? false,
    fallback_limit: role.hwid?.fallback_limit ?? null,
    min_limit: role.hwid?.min_limit ?? null,
    max_limit: role.hwid?.max_limit ?? null,
  },
  disabled_when_limited: role.is_owner ? false : roleFeatureBool(role.features, 'blockLimitedAdmins', booleanValue(role.disabled_when_limited, false)),
  disconnect_users_when_limited: role.is_owner ? false : roleFeatureBool(role.features, 'disconnectUsersWhenLimited', booleanValue(role.disconnect_users_when_limited, true)),
  disconnect_users_when_disabled: role.is_owner ? false : roleFeatureBool(role.features, 'disconnectUsersWhenDisabled', booleanValue(role.disconnect_users_when_disabled, true)),
})

export const adminRoleFormToPayload = (values: AdminRoleFormValues) => {
  // Convert form's day-based fields back to seconds, then drop empty/null entries
  const limitsRaw = {
    max_users: values.limits.max_users,
    data_limit_min: values.limits.data_limit_min,
    data_limit_max: values.limits.data_limit_max,
    expire_min: daysToSeconds(values.limits.expire_days_min),
    expire_max: daysToSeconds(values.limits.expire_days_max),
    download_mbps_min: values.limits.download_mbps_min,
    download_mbps_max: values.limits.download_mbps_max,
    upload_mbps_min: values.limits.upload_mbps_min,
    upload_mbps_max: values.limits.upload_mbps_max,
    minDownloadMbps: values.limits.download_mbps_min,
    maxDownloadMbps: values.limits.download_mbps_max,
    minUploadMbps: values.limits.upload_mbps_min,
    maxUploadMbps: values.limits.upload_mbps_max,
  }

  return {
    name: values.name.trim(),
    permissions: sanitizeRolePermissions(values.permissions as RolePermissionInput) as RolePermissions,
    limits: Object.fromEntries(Object.entries(limitsRaw).filter(hasValue)) as RoleLimits,
    features: {
      ...values.features,
      blockLimitedAdmins: values.disabled_when_limited,
      disconnectUsersWhenLimited: values.disconnect_users_when_limited,
      disconnectUsersWhenDisabled: values.disconnect_users_when_disabled,
    } as RoleFeatures,
    access: {
      allowed_inbound_ids: values.access.allowed_inbound_ids?.length ? values.access.allowed_inbound_ids : null,
    } as RoleAccess,
    hwid: {
      mode: values.hwid.mode,
      enabled: values.hwid.mode === 'override' ? true : values.hwid.mode !== 'disabled',
      forced: values.hwid.mode === 'override' && values.hwid.forced,
      fallback_limit: values.hwid.mode === 'override' ? (values.hwid.fallback_limit ?? null) : null,
      min_limit: values.hwid.mode === 'override' ? (values.hwid.min_limit ?? null) : null,
      max_limit: values.hwid.mode === 'override' ? (values.hwid.max_limit ?? null) : null,
    },
    disabled_when_limited: values.disabled_when_limited,
    disconnect_users_when_limited: values.disconnect_users_when_limited,
    disconnect_users_when_disabled: values.disconnect_users_when_disabled,
  }
}

export const BUILT_IN_ROLE_IDS = new Set([1, 2, 3])

export const isProtectedRole = (role: AdminRoleResponse) => role.is_owner || BUILT_IN_ROLE_IDS.has(role.id)

export const isReadOnlyRole = (role: AdminRoleResponse) => role.is_owner
