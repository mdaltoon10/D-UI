import { useEffect, useMemo, useState } from 'react';
import { Card, Progress } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  ApartmentOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloudUploadOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { HttpUtil, SizeFormatter, IntlUtil } from '@/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useDatepicker } from '@/hooks/useDatepicker';
import { keys } from '@/api/queryKeys';
import { useInboundOptions } from '@/api/queries/useInboundOptions';
import { getStatTranslations } from '@/utils/overviewI18n';
import type { Status } from '@/models/status';
import './OverviewStatsCard.css';
import './ResellerDashboard.css';

interface ResellerAdmin {
  id: string;
  remark?: string;
  username: string;
  volumeGB: number;
  days: number;
  trafficUsedBytes: number;
  clientsCount: number;
  clientLimit?: number;
  createdAt: number;
  expiryTime: number;
  enable: boolean;
  inbounds?: number[];
}

function formatTrafficQuota(volumeGB?: number | null, unlimitedText = 'Unlimited'): string {
  if (!volumeGB || volumeGB <= 0) return unlimitedText;
  if (volumeGB >= 1000) {
    const tb = volumeGB / 1000;
    const tbStr = Number.isInteger(tb) ? `${tb}` : Number(tb.toFixed(2)).toString();
    return `${tbStr} TB`;
  }
  return `${volumeGB} GB`;
}

export default function ResellerDashboard({ currentAdminRaw }: { currentAdminRaw: string; status: Status }) {
  const { i18n } = useTranslation();
  const tr = useMemo(() => getStatTranslations(i18n.language), [i18n.language]);
  const { isMobile } = useMediaQuery();
  const { datepicker } = useDatepicker();
  const [adminInfo, setAdminInfo] = useState<ResellerAdmin | null>(null);

  const parsedAdmin = useMemo(() => {
    try {
      return JSON.parse(currentAdminRaw);
    } catch {
      return null;
    }
  }, [currentAdminRaw]);

  useEffect(() => {
    HttpUtil.get<ResellerAdmin[]>('/panel/api/admins/list', undefined, { silent: true })
      .then((res) => {
        if (res.success && Array.isArray(res.obj)) {
          let me = null;
          if (parsedAdmin?.username) {
            me = res.obj.find((a) => a.username === parsedAdmin.username);
          }
          if (!me && res.obj.length > 0) {
            me = res.obj[0];
          }
          if (me) setAdminInfo(me);
        }
      })
      .catch(() => {});
  }, [parsedAdmin?.username]);

  // 1. Inbounds Count
  const { data: inboundsData } = useInboundOptions();
  const inboundsCount = useMemo(() => {
    if (adminInfo?.inbounds && Array.isArray(adminInfo.inbounds)) {
      return adminInfo.inbounds.length;
    }
    return Array.isArray(inboundsData) ? inboundsData.length : 0;
  }, [adminInfo, inboundsData]);

  // 2. Reseller Clients data (strictly non-expired calculation)
  const { data: clientsData } = useQuery({
    queryKey: ['clients', 'resellerClientsSummary', adminInfo?.username],
    queryFn: async () => {
      const msg = await HttpUtil.get<{
        total?: number;
        items?: Array<{
          email?: string;
          enable?: boolean;
          expiryTime?: number;
          total?: number;
          totalGB?: number;
          up?: number;
          down?: number;
          traffic?: { up: number; down: number };
          createdBy?: string;
        }>;
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

  // Calculate active clients (strictly non-expired and enabled)
  const { activeCount, totalCount } = useMemo(() => {
    if (typeof clientsData?.summary?.active === 'number') {
      return {
        activeCount: clientsData.summary.active,
        totalCount: clientsData.total ?? adminInfo?.clientsCount ?? 0,
      };
    }

    if (!clientsData?.items) {
      return {
        activeCount: adminInfo?.clientsCount || 0,
        totalCount: adminInfo?.clientsCount || 0,
      };
    }

    const now = Date.now();
    let act = 0;
    let tot = 0;

    clientsData.items.forEach((c) => {
      // If client createdBy belongs to this reseller or all
      if (adminInfo?.username && c.createdBy && c.createdBy !== adminInfo.username) {
        return;
      }
      tot++;

      // Check if enabled
      if (c.enable === false) return;
      // Check if NOT expired (expiryTime is 0 or in future)
      if (c.expiryTime && c.expiryTime > 0 && c.expiryTime <= now) return;
      // Check if traffic not depleted
      const used = (c.up || 0) + (c.down || 0) + (c.traffic?.up || 0) + (c.traffic?.down || 0);
      const limit = c.total || c.totalGB || 0;
      if (limit > 0 && used >= limit) return;

      act++;
    });

    return { activeCount: act, totalCount: tot || adminInfo?.clientsCount || 0 };
  }, [clientsData, adminInfo]);

  // 3. Online clients: strictly count only online clients that belong to this reseller
  const { data: onlineList } = useQuery({
    queryKey: keys.clients.onlines(),
    queryFn: async () => {
      const msg = await HttpUtil.post<string[]>('/panel/api/clients/onlines', undefined, { silent: true });
      return Array.isArray(msg?.obj) ? msg.obj : [];
    },
    refetchInterval: 5000,
  });

  const onlineCount = useMemo(() => {
    if (!onlineList || !Array.isArray(onlineList) || onlineList.length === 0) return 0;

    if (clientsData?.items && Array.isArray(clientsData.items)) {
      const resellerEmails = new Set<string>();
      clientsData.items.forEach((c) => {
        if (adminInfo?.username && c.createdBy && c.createdBy !== adminInfo.username) {
          return;
        }
        if (c.email) {
          resellerEmails.add(c.email.trim().toLowerCase());
        }
      });

      let count = 0;
      for (const email of onlineList) {
        if (email && resellerEmails.has(email.trim().toLowerCase())) {
          count++;
        }
      }
      return count;
    }

    return 0;
  }, [onlineList, clientsData, adminInfo]);

  // Quota & Expiry Calculations
  const volumeTotal = adminInfo?.volumeGB ? adminInfo.volumeGB * 1073741824 : 0;
  const volumeUsed = adminInfo?.trafficUsedBytes || 0;
  const volumePercent = volumeTotal > 0 ? (volumeUsed / volumeTotal) * 100 : 0;
  const isUnlimitedVolume = !adminInfo || volumeTotal <= 0;

  const expiryTime = adminInfo?.expiryTime || 0;
  const createdAt = adminInfo?.createdAt || 0;
  const now = Date.now();
  const isUnlimitedTime = !adminInfo || expiryTime <= 0;

  let totalDays = adminInfo?.days || 0;
  let daysRemaining = 0;
  let timePercent = 0;

  if (!isUnlimitedTime) {
    const diffMs = expiryTime - now;
    daysRemaining = diffMs > 0 ? Math.ceil(diffMs / 86400000) : 0;
    if (totalDays <= 0 || daysRemaining > totalDays) {
      totalDays = Math.max(daysRemaining, Math.ceil((expiryTime - (createdAt || (now - 86400000))) / 86400000));
    }
    const daysUsed = Math.max(0, totalDays - daysRemaining);
    timePercent = totalDays > 0 ? Math.min(100, (daysUsed / totalDays) * 100) : 0;
  }

  const clientLimit = adminInfo?.clientLimit || 0;
  const isUnlimitedClient = clientLimit <= 0;
  const clientLimitPercent = isUnlimitedClient ? 100 : Math.min(100, (totalCount / clientLimit) * 100);

  const statCards = [
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
      color: '#f59e0b',
      bgGlow: 'rgba(245, 158, 11, 0.12)',
      borderColor: 'rgba(245, 158, 11, 0.25)',
    },
    {
      id: 'online',
      title: tr.onlineClients,
      value: onlineCount,
      icon: <ThunderboltOutlined />,
      color: '#10b981',
      bgGlow: 'rgba(16, 185, 129, 0.12)',
      borderColor: 'rgba(16, 185, 129, 0.25)',
      isLive: true,
    },
    {
      id: 'total',
      title: tr.totalClients,
      value: totalCount,
      icon: <TeamOutlined />,
      color: '#a855f7',
      bgGlow: 'rgba(168, 85, 247, 0.12)',
      borderColor: 'rgba(168, 85, 247, 0.25)',
    },
  ];

  return (
    <div className="reseller-dashboard-wrap">
      {/* 1. Sleek Compact Stats Grid */}
      <Card hoverable className="overview-stats-card" styles={{ body: { padding: 0 } }}>
        <div className="reseller-stats-grid">
          {statCards.map((item) => (
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

      {/* 2. Sleek Quota & Expiry Usage Cards */}
      <Card hoverable className="reseller-overview-card" styles={{ body: { padding: 0 } }}>
        <div className="reseller-quota-grid">
          {/* Traffic Quota */}
          <div className="reseller-quota-card">
            <div className="quota-header">
              <div className="quota-title-wrap">
                <CloudUploadOutlined style={{ color: '#00b4d8' }} />
                <span>{tr.trafficQuota}</span>
              </div>
              <span
                className="quota-pill"
                style={{
                  background: isUnlimitedVolume ? 'rgba(0, 180, 216, 0.15)' : 'rgba(6, 182, 212, 0.15)',
                  color: isUnlimitedVolume ? '#00b4d8' : '#06b6d4',
                }}
              >
                {isUnlimitedVolume ? tr.unlimited : `${volumePercent.toFixed(1)}%`}
              </span>
            </div>

            <Progress
              percent={isUnlimitedVolume ? 100 : Number(volumePercent.toFixed(1))}
              showInfo={false}
              strokeColor={{
                '0%': '#00b4d8',
                '100%': volumePercent > 85 ? '#ef4444' : volumePercent > 70 ? '#f59e0b' : '#06b6d4',
              }}
              trailColor="rgba(255, 255, 255, 0.08)"
              size={['100%', isMobile ? 6 : 8]}
            />

            <div className="quota-details">
              <span>{tr.used} <b className="quota-val-highlight">{SizeFormatter.sizeFormat(volumeUsed)}</b></span>
              <span>{tr.total} <b>{isUnlimitedVolume ? tr.unlimited : formatTrafficQuota(adminInfo?.volumeGB, tr.unlimited)}</b></span>
            </div>
          </div>

          {/* Time / Validity Quota */}
          <div className="reseller-quota-card">
            <div className="quota-header">
              <div className="quota-title-wrap">
                <CalendarOutlined style={{ color: '#f59e0b' }} />
                <span>{tr.timeValidity}</span>
              </div>
              <span
                className="quota-pill"
                style={{
                  background: isUnlimitedTime ? 'rgba(0, 180, 216, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                  color: isUnlimitedTime ? '#00b4d8' : '#f59e0b',
                }}
              >
                {isUnlimitedTime ? tr.unlimited : `${daysRemaining} ${tr.daysLeft}`}
              </span>
            </div>

            <Progress
              percent={isUnlimitedTime ? 100 : Number(timePercent.toFixed(1))}
              showInfo={false}
              strokeColor={{
                '0%': '#00b4d8',
                '100%': daysRemaining <= 3 ? '#ef4444' : daysRemaining <= 7 ? '#f59e0b' : '#00b4d8',
              }}
              trailColor="rgba(255, 255, 255, 0.08)"
              size={['100%', isMobile ? 6 : 8]}
            />

            <div className="quota-details">
              <span>{tr.status} <b className="quota-val-highlight" style={{ color: daysRemaining <= 3 && !isUnlimitedTime ? '#ef4444' : '#00b4d8' }}>{isUnlimitedTime ? tr.permanent : (daysRemaining > 0 ? tr.active : tr.expired)}</b></span>
              <span>{tr.expiry} <b>{isUnlimitedTime ? tr.noExpiry : IntlUtil.formatDate(expiryTime, datepicker)}</b></span>
            </div>
          </div>

          {/* Client Limit Quota */}
          <div className="reseller-quota-card">
            <div className="quota-header">
              <div className="quota-title-wrap">
                <UserOutlined style={{ color: '#a855f7' }} />
                <span>{tr.clientLimitQuota}</span>
              </div>
              <span
                className="quota-pill"
                style={{
                  background: isUnlimitedClient ? 'rgba(168, 85, 247, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                  color: '#a855f7',
                }}
              >
                {isUnlimitedClient ? tr.unlimited : `${clientLimitPercent.toFixed(0)}%`}
              </span>
            </div>

            <Progress
              percent={isUnlimitedClient ? 100 : Number(clientLimitPercent.toFixed(1))}
              showInfo={false}
              strokeColor={{
                '0%': '#a855f7',
                '100%': clientLimitPercent >= 90 ? '#ef4444' : clientLimitPercent >= 75 ? '#f59e0b' : '#a855f7',
              }}
              trailColor="rgba(255, 255, 255, 0.08)"
              size={['100%', isMobile ? 6 : 8]}
            />

            <div className="quota-details">
              <span>{tr.used} <b className="quota-val-highlight">{totalCount}</b></span>
              <span>{tr.total} <b>{isUnlimitedClient ? tr.unlimited : `${clientLimit} ${tr.clientCount}`}</b></span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
