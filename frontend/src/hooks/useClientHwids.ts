import { useCallback, useState } from 'react';
import { HttpUtil } from '@/utils';
import { normalizeClientHwids, type ClientHwidInfo } from '@/lib/clients/hwid-log';

interface ApiMsg<T = unknown> {
  success?: boolean;
  obj?: T;
}

// Fetch/mutate state for one client's registered-device list, shared by the
// edit form and the info card. No email (add-client form) => every action no-ops.
export function useClientHwids(email: string | undefined) {
  const [clientHwids, setClientHwids] = useState<ClientHwidInfo[]>([]);
  const [hwidsLoading, setHwidsLoading] = useState(false);
  const [hwidsClearing, setHwidsClearing] = useState(false);
  const [deletingHwidId, setDeletingHwidId] = useState<number | null>(null);

  const loadHwids = useCallback(async () => {
    if (!email) return;
    setHwidsLoading(true);
    try {
      const msg = (await HttpUtil.post(
        `/panel/api/clients/hwids/${encodeURIComponent(email)}`,
      )) as ApiMsg<unknown[]>;
      if (!msg?.success) {
        setClientHwids([]);
        return;
      }
      setClientHwids(normalizeClientHwids(msg.obj));
    } finally {
      setHwidsLoading(false);
    }
  }, [email]);

  const clearHwids = useCallback(async () => {
    if (!email) return;
    setHwidsClearing(true);
    try {
      const msg = (await HttpUtil.delete(
        `/panel/api/clients/hwids/${encodeURIComponent(email)}`,
      )) as ApiMsg;
      if (msg?.success) setClientHwids([]);
    } finally {
      setHwidsClearing(false);
    }
  }, [email]);

  const deleteHwid = useCallback(async (id: number) => {
    if (!email) return;
    setDeletingHwidId(id);
    try {
      const msg = (await HttpUtil.delete(
        `/panel/api/clients/hwids/${encodeURIComponent(email)}/${id}`,
      )) as ApiMsg;
      if (msg?.success) setClientHwids((prev) => prev.filter((entry) => entry.id !== id));
    } finally {
      setDeletingHwidId(null);
    }
  }, [email]);

  const resetHwids = useCallback(() => {
    setClientHwids([]);
  }, []);

  return {
    clientHwids,
    hwidsLoading,
    hwidsClearing,
    deletingHwidId,
    loadHwids,
    clearHwids,
    deleteHwid,
    resetHwids,
  };
}
