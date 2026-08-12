import type { QueryClient } from '@tanstack/react-query';
import type { AdminDetails } from '@/pg-ui/service/api';

type AdminsCollection = {
  admins?: AdminDetails[];
  data?: AdminDetails[];
  items?: AdminDetails[];
  total?: number;
  total_count?: number;
  active?: number;
  disabled?: number;
  limited?: number;
  [key: string]: unknown;
};

function isAdmin(value: unknown): value is AdminDetails {
  return !!value && typeof value === 'object' && typeof (value as AdminDetails).id === 'number';
}

function updateList(list: AdminDetails[] | undefined, updater: (list: AdminDetails[]) => AdminDetails[]): AdminDetails[] | undefined {
  if (!Array.isArray(list)) return list;
  return updater(list);
}

function upsertList(list: AdminDetails[], admin: AdminDetails, allowInsert: boolean): AdminDetails[] {
  const index = list.findIndex(item => item.id === admin.id || item.username === admin.username);
  if (index >= 0) {
    const next = [...list];
    next[index] = { ...next[index], ...admin };
    return next;
  }
  return allowInsert ? [admin, ...list] : list;
}

function removeFromList(list: AdminDetails[], adminId: number): AdminDetails[] {
  return list.filter(admin => admin.id !== adminId);
}

function patchList(list: AdminDetails[], adminId: number, patch: Partial<AdminDetails>): AdminDetails[] {
  return list.map(admin => (admin.id === adminId ? { ...admin, ...patch } : admin));
}

function recalculateCounts(collection: AdminsCollection): AdminsCollection {
  const list = collection.admins || collection.data || collection.items || [];
  const active = list.filter(admin => (admin.status || (admin.is_disabled ? 'disabled' : 'active')) !== 'disabled').length;
  const disabled = list.filter(admin => (admin.status || (admin.is_disabled ? 'disabled' : 'active')) === 'disabled').length;
  const limited = list.filter(admin => typeof admin.data_limit === 'number' && admin.data_limit > 0).length;

  return {
    ...collection,
    total: list.length,
    total_count: list.length,
    active,
    disabled,
    limited,
  };
}

function transformAdminCollection(
  data: unknown,
  transform: (list: AdminDetails[]) => AdminDetails[],
): unknown {
  if (Array.isArray(data)) {
    return transform(data.filter(isAdmin));
  }

  if (!data || typeof data !== 'object') return data;

  const collection = data as AdminsCollection;
  const admins = updateList(collection.admins, transform);
  const rows = updateList(collection.data, transform);
  const items = updateList(collection.items, transform);

  return recalculateCounts({
    ...collection,
    ...(admins ? { admins } : {}),
    ...(rows ? { data: rows } : {}),
    ...(items ? { items } : {}),
  });
}

function updateAdminsQueries(queryClient: QueryClient, transform: (list: AdminDetails[]) => AdminDetails[]) {
  queryClient.setQueriesData({ queryKey: ['pg-ui', 'admins'], exact: false }, data => transformAdminCollection(data, transform));
}

export function removeAdminFromAdminsCache(queryClient: QueryClient, adminId: number) {
  updateAdminsQueries(queryClient, list => removeFromList(list, adminId));
}

export function upsertAdminInAdminsCache(
  queryClient: QueryClient,
  admin: AdminDetails,
  options: { allowInsert?: boolean } = {},
) {
  updateAdminsQueries(queryClient, list => upsertList(list, admin, options.allowInsert ?? false));
}

export function patchAdminInAdminsCache(
  queryClient: QueryClient,
  adminId: number,
  patch: Partial<AdminDetails>,
) {
  updateAdminsQueries(queryClient, list => patchList(list, adminId, patch));
}
