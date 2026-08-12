import { useMutation, useQueryClient } from '@tanstack/react-query';

import { keys } from '@/api/queryKeys';
import { HttpUtil } from '@/utils';
import type { AdminRoleRecord } from '@/api/queries/useAdminRolesQuery';

type ApiMsg<T = unknown> = {
  success?: boolean;
  msg?: string;
  obj?: T;
};

const JSON_HEADERS = { headers: { 'Content-Type': 'application/json' } } as const;

export type AdminRolePayload = Partial<AdminRoleRecord> & {
  name?: string;
};

export function useAdminRoleMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: keys.adminRoles.root() });

  const createMut = useMutation<ApiMsg, Error, AdminRolePayload>({
    mutationFn: (payload) =>
      HttpUtil.post('/panel/api/admin-roles/add', payload, JSON_HEADERS) as Promise<ApiMsg>,
    onSuccess: (msg) => { if (msg?.success) invalidate(); },
  });

  const updateMut = useMutation<ApiMsg, Error, { id: number; payload: AdminRolePayload }>({
    mutationFn: ({ id, payload }) =>
      HttpUtil.post(`/panel/api/admin-roles/update/${id}`, payload, JSON_HEADERS) as Promise<ApiMsg>,
    onSuccess: (msg) => { if (msg?.success) invalidate(); },
  });

  const duplicateMut = useMutation<ApiMsg, Error, number>({
    mutationFn: (id) =>
      HttpUtil.post(`/panel/api/admin-roles/duplicate/${id}`, undefined, JSON_HEADERS) as Promise<ApiMsg>,
    onSuccess: (msg) => { if (msg?.success) invalidate(); },
  });

  const removeMut = useMutation<ApiMsg, Error, number>({
    mutationFn: (id) =>
      HttpUtil.post(`/panel/api/admin-roles/del/${id}`, undefined, JSON_HEADERS) as Promise<ApiMsg>,
    onSuccess: (msg) => { if (msg?.success) invalidate(); },
  });

  return {
    create: (payload: AdminRolePayload) => createMut.mutateAsync(payload),
    update: (id: number, payload: AdminRolePayload) => updateMut.mutateAsync({ id, payload }),
    duplicate: (id: number) => duplicateMut.mutateAsync(id),
    remove: (id: number) => removeMut.mutateAsync(id),

    creating: createMut.isPending,
    updating: updateMut.isPending,
    duplicating: duplicateMut.isPending,
    removing: removeMut.isPending,
  };
}
