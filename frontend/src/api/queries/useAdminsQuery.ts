import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { keys } from '@/api/queryKeys';
import { HttpUtil } from '@/utils';

type ApiMsg<T> = {
  success?: boolean;
  msg?: string;
  obj?: T;
};

export interface AdminRecord {
  id: number;
  username: string;
  roleId: number;
  roleName: string;
  roleSlug: string;
  status: 'active' | 'disabled' | string;
  dataLimit: number;
  usedBytes: number;
  totalUsers: number;
  telegramId: string;
  discordWebhook: string;
  supportUrl: string;
  profileTitle: string;
  subscriptionDomain: string;
  subscriptionTemplatePath: string;
  note: string;
  notificationFilters?: unknown;
  permissionOverrides?: unknown;
  createdAt?: number;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface AdminStats {
  totalAdmins: number;
  activeAdmins: number;
  disabledAdmins: number;
  limitedAdmins: number;
}

const EMPTY_STATS: AdminStats = {
  totalAdmins: 0,
  activeAdmins: 0,
  disabledAdmins: 0,
  limitedAdmins: 0,
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function toNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number(value || 0);
}

function toString(value: unknown): string {
  return typeof value === 'string' ? value : String(value ?? '');
}

function normalizeAdmin(value: unknown): AdminRecord {
  const row = asRecord(value);
  return {
    ...row,
    id: toNumber(row.id),
    username: toString(row.username),
    roleId: toNumber(row.roleId),
    roleName: toString(row.roleName),
    roleSlug: toString(row.roleSlug),
    status: toString(row.status) || 'active',
    dataLimit: toNumber(row.dataLimit),
    usedBytes: toNumber(row.usedBytes),
    totalUsers: toNumber(row.totalUsers),
    telegramId: toString(row.telegramId),
    discordWebhook: toString(row.discordWebhook),
    supportUrl: toString(row.supportUrl),
    profileTitle: toString(row.profileTitle),
    subscriptionDomain: toString(row.subscriptionDomain),
    subscriptionTemplatePath: toString(row.subscriptionTemplatePath),
    note: toString(row.note),
    notificationFilters: row.notificationFilters,
    permissionOverrides: row.permissionOverrides,
    createdAt: row.createdAt === undefined ? undefined : toNumber(row.createdAt),
    updatedAt: row.updatedAt === undefined ? undefined : toNumber(row.updatedAt),
  };
}

function normalizeStats(value: unknown): AdminStats {
  const row = asRecord(value);
  return {
    totalAdmins: toNumber(row.totalAdmins),
    activeAdmins: toNumber(row.activeAdmins),
    disabledAdmins: toNumber(row.disabledAdmins),
    limitedAdmins: toNumber(row.limitedAdmins),
  };
}

async function fetchAdmins(): Promise<AdminRecord[]> {
  const msg = await HttpUtil.get('/panel/api/admins/list', undefined, { silent: true }) as ApiMsg<unknown>;
  if (!msg?.success) throw new Error(msg?.msg || 'Failed to fetch admins');
  return Array.isArray(msg.obj) ? msg.obj.map(normalizeAdmin) : [];
}

async function fetchAdminStats(): Promise<AdminStats> {
  const msg = await HttpUtil.get('/panel/api/admins/stats', undefined, { silent: true }) as ApiMsg<unknown>;
  if (!msg?.success) throw new Error(msg?.msg || 'Failed to fetch admin stats');
  return normalizeStats(msg.obj);
}

export function useAdminsQuery() {
  const listQuery = useQuery({
    queryKey: keys.admins.list(),
    queryFn: fetchAdmins,
  });

  const statsQuery = useQuery({
    queryKey: keys.admins.stats(),
    queryFn: fetchAdminStats,
  });

  const admins = useMemo(() => listQuery.data ?? [], [listQuery.data]);
  const stats = useMemo(() => statsQuery.data ?? EMPTY_STATS, [statsQuery.data]);

  const loading = listQuery.isFetching || statsQuery.isFetching;
  const fetched = (listQuery.data !== undefined || listQuery.isError)
    && (statsQuery.data !== undefined || statsQuery.isError);

  const fetchError = [
    listQuery.error ? (listQuery.error as Error).message : '',
    statsQuery.error ? (statsQuery.error as Error).message : '',
  ].filter(Boolean).join('\n');

  return {
    admins,
    stats,
    loading,
    fetched,
    fetchError,
    refetch: async () => {
      await Promise.all([listQuery.refetch(), statsQuery.refetch()]);
    },
  };
}
