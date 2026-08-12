import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { keys } from '@/api/queryKeys';
import { HttpUtil } from '@/utils';

type ApiMsg<T> = {
  success?: boolean;
  msg?: string;
  obj?: T;
};

export interface AdminRoleRecord {
  id: number;
  name: string;
  slug: string;
  builtIn: boolean;
  ownerRole: boolean;
  permissions?: unknown;
  limits?: unknown;
  features?: unknown;
  access?: unknown;
  createdAt?: number;
  updatedAt?: number;
  [key: string]: unknown;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function toNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number(value || 0);
}

function toBool(value: unknown): boolean {
  return value === true || value === 'true' || value === 1;
}

function normalizeRole(value: unknown): AdminRoleRecord {
  const row = asRecord(value);
  return {
    ...row,
    id: toNumber(row.id),
    name: String(row.name ?? ''),
    slug: String(row.slug ?? ''),
    builtIn: toBool(row.builtIn),
    ownerRole: toBool(row.ownerRole),
    permissions: row.permissions,
    limits: row.limits,
    features: row.features,
    access: row.access,
    createdAt: row.createdAt === undefined ? undefined : toNumber(row.createdAt),
    updatedAt: row.updatedAt === undefined ? undefined : toNumber(row.updatedAt),
  };
}

async function fetchAdminRoles(): Promise<AdminRoleRecord[]> {
  const msg = await HttpUtil.get('/panel/api/admin-roles/list', undefined, { silent: true }) as ApiMsg<unknown>;
  if (!msg?.success) throw new Error(msg?.msg || 'Failed to fetch admin roles');
  return Array.isArray(msg.obj) ? msg.obj.map(normalizeRole) : [];
}

export function useAdminRolesQuery() {
  const query = useQuery({
    queryKey: keys.adminRoles.list(),
    queryFn: fetchAdminRoles,
  });

  const adminRoles = useMemo(() => query.data ?? [], [query.data]);

  return {
    adminRoles,
    loading: query.isFetching,
    fetched: query.data !== undefined || query.isError,
    fetchError: query.error ? (query.error as Error).message : '',
    refetch: query.refetch,
  };
}
