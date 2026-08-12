import { useEffect, useMemo, useState } from 'react';
import { HttpUtil } from '@/utils';
import type { AdminDetails } from '@/pg-ui/service/api';

type ApiMsg<T = unknown> = {
  success?: boolean
  msg?: string
  obj?: T
}

type CurrentAdmin = AdminDetails


function toNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function toString(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

function normalizeCurrentAdmin(raw: any): CurrentAdmin | null {
  if (!raw || typeof raw !== 'object') return null

  const role = raw.role && typeof raw.role === 'object' ? raw.role : {}
  const permissions = role.permissions ?? raw.permissions ?? {}

  return {
    id: toNumber(raw.id),
    username: toString(raw.username),
    status: toString(raw.status),
    roleId: toNumber(raw.roleId ?? raw.role_id),
    role_id: toNumber(raw.role_id ?? raw.roleId),
    profileTitle: toString(raw.profileTitle ?? raw.profile_title),
    profile_title: toString(raw.profile_title ?? raw.profileTitle),
    permissions,
    limits: role.limits ?? raw.limits ?? {},
    features: role.features ?? raw.features ?? {},
    access: role.access ?? raw.access ?? {},
    allowedGroupIds: role.allowedGroupIds ?? role.allowed_group_ids ?? raw.allowedGroupIds ?? raw.allowed_group_ids,
    allowed_group_ids: role.allowed_group_ids ?? role.allowedGroupIds ?? raw.allowed_group_ids ?? raw.allowedGroupIds,
    role: {
      id: toNumber(role.id),
      name: toString(role.name),
      slug: toString(role.slug),
      is_builtin: Boolean(role.is_builtin ?? role.builtIn),
      builtIn: Boolean(role.builtIn ?? role.is_builtin),
      is_owner: Boolean(role.is_owner ?? role.ownerRole ?? role.owner_role),
      ownerRole: Boolean(role.ownerRole ?? role.is_owner ?? role.owner_role),
      owner_role: Boolean(role.owner_role ?? role.ownerRole ?? role.is_owner),
      permissions,
      limits: role.limits ?? raw.limits ?? {},
      features: role.features ?? raw.features ?? {},
      access: role.access ?? raw.access ?? {},
      allowedGroupIds: role.allowedGroupIds ?? role.allowed_group_ids ?? raw.allowedGroupIds ?? raw.allowed_group_ids,
      allowed_group_ids: role.allowed_group_ids ?? role.allowedGroupIds ?? raw.allowed_group_ids ?? raw.allowedGroupIds,
    },
  }
}

export function useAdmin() {
  const [admin, setAdmin] = useState<CurrentAdmin | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadCurrentAdmin() {
      setIsLoading(true)
      setError('')

      try {
        const msg = await HttpUtil.get('/panel/api/admins/current', undefined, { silent: true }) as ApiMsg<unknown>
        if (cancelled) return

        if (msg?.success === false) {
          throw new Error(msg?.msg || 'Failed to load current admin')
        }

        const normalized = normalizeCurrentAdmin(msg?.obj ?? msg)
        if (!normalized) {
          throw new Error('Invalid current admin payload')
        }

        setAdmin(normalized)
      } catch (err) {
        if (cancelled) return
        setAdmin(null)
        setError(err instanceof Error ? err.message : 'Failed to load current admin')
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadCurrentAdmin()

    return () => {
      cancelled = true
    }
  }, [])

  return useMemo(() => ({
    admin,
    isLoading,
    loading: isLoading,
    error,
  }), [admin, isLoading, error])
}
