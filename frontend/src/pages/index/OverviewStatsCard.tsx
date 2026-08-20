import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from 'antd';
import {
  ApartmentOutlined,
  CheckCircleOutlined,
  CloudServerOutlined,
  CrownOutlined,
  TagsOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { HttpUtil } from '@/utils';
import { keys } from '@/api/queryKeys';
import { useInboundOptions } from '@/api/queries/useInboundOptions';
import { useNodesQuery } from '@/api/queries/useNodesQuery';
import { getStatTranslations } from '@/utils/overviewI18n';
import './OverviewStatsCard.css';

interface OverviewStatsCardProps {
  isMobile: boolean;
}

export default function OverviewStatsCard({ isMobile: _isMobile }: OverviewStatsCardProps) {
  const { i18n } = useTranslation();
  const tr = useMemo(() => getStatTranslations(i18n.language), [i18n.language]);

  // 0. Inbounds count
  const { data: inboundsData } = useInboundOptions();
  const inboundsCount = Array.isArray(inboundsData) ? inboundsData.length : 0;

  // 1. Online clients count
  const { data: onlineList } = useQuery({
    queryKey: keys.clients.onlines(),
    queryFn: async () => {
      const msg = await HttpUtil.post<string[]>('/panel/api/clients/onlines', undefined, { silent: true });
      return Array.isArray(msg?.obj) ? msg.obj : [];
    },
    refetchInterval: 5000,
  });
  const onlineCount = onlineList?.length ?? 0;

  // 2. Active clients count (strictly non-expired clients)
  const { data: clientsData } = useQuery({
    queryKey: ['clients', 'overviewStatsSummary'],
    queryFn: async () => {
      const msg = await HttpUtil.get<{
        total?: number;
        items?: Array<{ enable?: boolean; expiryTime?: number; total?: number; totalGB?: number; up?: number; down?: number; traffic?: { up: number; down: number } }>;
        summary?: { active?: number; total?: number };
      }>(
        '/panel/api/clients/list/paged?page=1&pageSize=1000',
        undefined,
        { silent: true }
      );
      return msg?.obj;
    },
    staleTime: 10000,
    refetchInterval: 10000,
  });

  const activeCount = useMemo(() => {
    if (!clientsData) return 0;
    if (typeof clientsData.summary?.active === 'number') {
      return clientsData.summary.active;
    }
    if (Array.isArray(clientsData.items)) {
      const now = Date.now();
      const active = clientsData.items.filter((c) => {
        if (c.enable === false) return false;
        // Non-expired: expiryTime is 0 (unlimited) or > now
        if (c.expiryTime && c.expiryTime > 0 && c.expiryTime <= now) return false;
        // Traffic not exhausted
        const used = (c.up || 0) + (c.down || 0) + (c.traffic?.up || 0) + (c.traffic?.down || 0);
        const limit = c.total || c.totalGB || 0;
        if (limit > 0 && used >= limit) return false;
        return true;
      });
      return active.length;
    }
    return clientsData.total ?? 0;
  }, [clientsData]);

  // 3. Groups count
  const { data: groupsData } = useQuery({
    queryKey: keys.clients.groups(),
    queryFn: async () => {
      const msg = await HttpUtil.get<unknown[]>('/panel/api/clients/groups', undefined, { silent: true });
      return Array.isArray(msg?.obj) ? msg.obj : [];
    },
    staleTime: 15000,
  });
  const groupsCount = groupsData?.length ?? 0;

  // 4. Nodes count
  const { nodes } = useNodesQuery();
  const nodesCount = nodes?.length ?? 0;

  // 5. Admins / Resellers count
  const { data: adminsData } = useQuery({
    queryKey: ['admins', 'overviewList'],
    queryFn: async () => {
      const msg = await HttpUtil.get<unknown[]>('/panel/api/admins/list', undefined, { silent: true });
      return Array.isArray(msg?.obj) ? msg.obj : [];
    },
    staleTime: 15000,
  });
  const adminsCount = adminsData?.length ?? 0;

  const stats = [
    {
      id: 'inbounds',
      title: tr.inbounds,
      value: inboundsCount,
      icon: <ApartmentOutlined />,
      color: '#38bdf8',
      bgGlow: 'rgba(56, 189, 248, 0.12)',
      borderColor: 'rgba(56, 189, 248, 0.25)',
    },
    {
      id: 'active',
      title: tr.activeClients,
      value: activeCount,
      icon: <CheckCircleOutlined />,
      color: '#14b8a6',
      bgGlow: 'rgba(20, 184, 166, 0.12)',
      borderColor: 'rgba(20, 184, 166, 0.25)',
    },
    {
      id: 'online',
      title: tr.onlineClients,
      value: onlineCount,
      icon: <ThunderboltOutlined />,
      color: '#22c55e',
      bgGlow: 'rgba(34, 197, 94, 0.12)',
      borderColor: 'rgba(34, 197, 94, 0.25)',
      isLive: true,
    },
    {
      id: 'groups',
      title: tr.groups,
      value: groupsCount,
      icon: <TagsOutlined />,
      color: '#f59e0b',
      bgGlow: 'rgba(245, 158, 11, 0.12)',
      borderColor: 'rgba(245, 158, 11, 0.25)',
    },
    {
      id: 'nodes',
      title: tr.nodes,
      value: nodesCount,
      icon: <CloudServerOutlined />,
      color: '#8b5cf6',
      bgGlow: 'rgba(139, 92, 246, 0.12)',
      borderColor: 'rgba(139, 92, 246, 0.25)',
    },
    {
      id: 'admins',
      title: tr.adminsResellers,
      value: adminsCount,
      icon: <CrownOutlined />,
      color: '#ec4899',
      bgGlow: 'rgba(236, 72, 153, 0.12)',
      borderColor: 'rgba(236, 72, 153, 0.25)',
    },
  ];

  return (
    <Card hoverable className="overview-stats-card" styles={{ body: { padding: 0 } }}>
      <div className="overview-stats-grid">
        {stats.map((item) => (
          <div
            key={item.id}
            className="overview-stat-tile"
            style={{
              background: item.bgGlow,
              borderColor: item.borderColor,
            }}
          >
            <div className="stat-tile-top">
              <span className="stat-tile-icon" style={{ color: item.color }}>
                {item.icon}
              </span>
              {item.isLive && (
                <span className="stat-live-badge">
                  <span className="stat-live-dot" />
                  {tr.live}
                </span>
              )}
            </div>

            <div className="stat-tile-bottom">
              <div className="stat-tile-number" style={{ color: item.color }}>
                {item.value.toLocaleString()}
              </div>
              <div className="stat-tile-title">{item.title}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
