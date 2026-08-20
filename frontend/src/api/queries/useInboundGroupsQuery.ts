import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { HttpUtil } from '@/utils';
import { parseMsg } from '@/utils/zodValidate';
import { InboundGroupListSchema, type InboundGroupSummary } from '@/schemas/inboundGroup';
import { keys } from '@/api/queryKeys';

async function fetchInboundGroups(): Promise<InboundGroupSummary[]> {
  const msg = await HttpUtil.get('/panel/api/inbound-groups/list', undefined, { silent: true });
  if (!msg?.success) throw new Error(msg?.msg || 'Failed to fetch inbound groups');
  const validated = parseMsg(msg, InboundGroupListSchema, 'inbound-groups/list');
  return Array.isArray(validated.obj) ? validated.obj : [];
}

export function useInboundGroupsQuery() {
  const query = useQuery({
    queryKey: keys.inboundGroups.list(),
    queryFn: fetchInboundGroups,
  });

  const inboundGroups = useMemo(() => query.data ?? [], [query.data]);

  return {
    ...query,
    inboundGroups,
  };
}
