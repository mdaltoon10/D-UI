import { useMutation, useQueryClient } from '@tanstack/react-query';

import { keys } from '@/api/queryKeys';
import { HttpUtil } from '@/utils';
import type { AdminRecord } from '@/api/queries/useAdminsQuery';

type ApiMsg<T = unknown> = {
  success?: boolean;
  msg?: string;
  obj?: T;
};

const JSON_HEADERS = { headers: { 'Content-Type': 'application/json' } } as const;

export type AdminPayload = Partial<AdminRecord> & {
  username: string;
  password?: string;
  roleId: number;
  status: string;
  dataLimit: number;
  notificationFilters?: Record<string, unknown>;
  permissionOverrides?: Record<string, unknown>;
};

export function useAdminMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: keys.admins.root() });

  const createMut = useMutation<ApiMsg, Error, AdminPayload>({
    mutationFn: (payload) =>
      HttpUtil.post('/panel/api/admins/add', payload, JSON_HEADERS) as Promise<ApiMsg>,
    onSuccess: (msg) => { if (msg?.success) invalidate(); },
  });

  const updateMut = useMutation<ApiMsg, Error, { id: number; payload: AdminPayload }>({
    mutationFn: ({ id, payload }) =>
      HttpUtil.post(`/panel/api/admins/update/${id}`, payload, JSON_HEADERS) as Promise<ApiMsg>,
    onSuccess: (msg) => { if (msg?.success) invalidate(); },
  });

  const enableMut = useMutation<ApiMsg, Error, number>({
    mutationFn: (id) =>
      HttpUtil.post(`/panel/api/admins/enable/${id}`, undefined, JSON_HEADERS) as Promise<ApiMsg>,
    onSuccess: (msg) => { if (msg?.success) invalidate(); },
  });

  const disableMut = useMutation<ApiMsg, Error, number>({
    mutationFn: (id) =>
      HttpUtil.post(`/panel/api/admins/disable/${id}`, undefined, JSON_HEADERS) as Promise<ApiMsg>,
    onSuccess: (msg) => { if (msg?.success) invalidate(); },
  });

  const resetUsageMut = useMutation<ApiMsg, Error, number>({
    mutationFn: (id) =>
      HttpUtil.post(`/panel/api/admins/resetUsage/${id}`, undefined, JSON_HEADERS) as Promise<ApiMsg>,
    onSuccess: (msg) => { if (msg?.success) invalidate(); },
  });

  const removeMut = useMutation<ApiMsg, Error, number>({
    mutationFn: (id) =>
      HttpUtil.post(`/panel/api/admins/del/${id}`, undefined, JSON_HEADERS) as Promise<ApiMsg>,
    onSuccess: (msg) => { if (msg?.success) invalidate(); },
  });

  return {
    create: (payload: AdminPayload) => createMut.mutateAsync(payload),
    update: (id: number, payload: AdminPayload) => updateMut.mutateAsync({ id, payload }),
    enable: (id: number) => enableMut.mutateAsync(id),
    disable: (id: number) => disableMut.mutateAsync(id),
    resetUsage: (id: number) => resetUsageMut.mutateAsync(id),
    remove: (id: number) => removeMut.mutateAsync(id),

    creating: createMut.isPending,
    updating: updateMut.isPending,
    enabling: enableMut.isPending,
    disabling: disableMut.isPending,
    resetting: resetUsageMut.isPending,
    removing: removeMut.isPending,
    saving: createMut.isPending || updateMut.isPending,
  };
}
