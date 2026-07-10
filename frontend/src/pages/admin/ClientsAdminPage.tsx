/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import {
  Card,
  Button,
  Input,
  Tag,
  Tooltip,
  Row,
  Col,
  message,
  Switch,
  Statistic,
  Table,
  ConfigProvider,
  Layout,
  Popconfirm,
  Modal,
  Popover,
  Space,
  Spin,
  Pagination,
  Badge,
  Dropdown,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  SearchOutlined,
  ReloadOutlined,
  TeamOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  PlusOutlined,
  MinusOutlined,
  UserOutlined,
  DatabaseOutlined,
  PieChartOutlined,
  QrcodeOutlined,
  InfoCircleOutlined,
  RetweetOutlined,
  EditOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { HttpUtil, SizeFormatter, IntlUtil } from '@/utils';
import { useTheme } from '@/hooks/useTheme';
import { useDatepicker } from '@/hooks/useDatepicker';
import { useClients } from '@/hooks/useClients';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { formatInboundLabel } from '@/lib/inbounds/label';
import ClientTrafficCell from '@/components/clients/ClientTrafficCell';
import { LazyMount } from '@/components/utility';
import AppSidebar from '@/layouts/AppSidebar';
import '@/pages/clients/ClientsPage.css'; // Inherit layout classes

interface ResellerAdmin {
  id: string;
  remark?: string;
  username: string;
  volumeGB: number;
  days: number;
  createdAt: number;
  expiryTime: number;
  enable: boolean;
  clientsCount: number;
  trafficUsedBytes: number;
}

interface ClientSlim {
  email: string;
  subId: string;
  enable: boolean;
  totalGB: number;
  expiryTime: number;
  limitIp: number;
  group?: string;
  comment?: string;
  createdBy?: string;
  inboundIds: number[];
  traffic?: {
    up: number;
    down: number;
    total: number;
    expiryTime: number;
    enable: boolean;
    lastOnline: number;
  };
}

const ClientFormModal = lazy(() => import('@/pages/clients/ClientFormModal'));
const ClientInfoModal = lazy(() => import('@/pages/clients/ClientInfoModal'));
const ClientQrModal = lazy(() => import('@/pages/clients/ClientQrModal'));

type Bucket = 'active' | 'deactive' | 'depleted' | 'expiring';

const INBOUND_PROTOCOL_COLORS: Record<string, string> = {
  vless: 'blue',
  vmess: 'geekblue',
  trojan: 'volcano',
  shadowsocks: 'magenta',
  hysteria: 'cyan',
  hysteria2: 'green',
  wireguard: 'gold',
  http: 'purple',
  mixed: 'lime',
  tunnel: 'orange',
};

const INBOUND_CHIP_LIMIT = 1;

// Nested sub-component to show clients of a specific admin
function AdminClientsSubList({
  adminUsername,
  adminInbounds = [],
  subEnable: _subEnable,
  subURI: _subURI,
  onClientChange,
  isFa,
}: {
  adminUsername: string;
  adminInbounds?: number[];
  subEnable: boolean;
  subURI: string;
  onClientChange: () => void;
  isFa: boolean;
}) {
  const { t } = useTranslation();
  const [messageApi, messageContextHolder] = message.useMessage();
  const { datepicker } = useDatepicker();
  const { isMobile } = useMediaQuery();
  
  const {
    inbounds,
    onlines,
    subSettings,
    hydrate,
    create,
    update,
    remove,
    attach,
    detach,
    setExternalLinks,
    resetTraffic,
    tgBotEnable,
    allGroups,
    expireDiff,
    trafficDiff,
    setEnable,
  } = useClients();

  const [clients, setClients] = useState<ClientSlim[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  // Modal states aligned with main ClientsPage
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [editingClient, setEditingClient] = useState<any | null>(null);
  const [editingAttachedIds, setEditingAttachedIds] = useState<number[]>([]);
  const [editingExternalLinks, setEditingExternalLinks] = useState<any[]>([]);

  const [infoOpen, setInfoOpen] = useState(false);
  const [infoClient, setInfoClient] = useState<any | null>(null);

  const [qrOpen, setQrOpen] = useState(false);
  const [qrClient, setQrClient] = useState<any | null>(null);

  const [togglingEmail, setTogglingEmail] = useState<string | null>(null);

  const dict = {
    searchPlaceholder: isFa ? 'جستجوی کلاینت...' : 'Search client...',
    btnCreateClient: isFa ? 'کلاینت جدید' : 'New Client',
    toastEnabled: isFa ? 'کلاینت فعال شد.' : 'Client enabled.',
    toastDisabled: isFa ? 'کلاینت غیرفعال شد.' : 'Client disabled.',
  };

  const fetchClients = useCallback(async (silentLoad?: boolean | React.SyntheticEvent | unknown) => {
    const isSilent = silentLoad === true;
    if (!isSilent) setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        search: searchText.trim(),
        createdBy: adminUsername,
      });

      const res = await HttpUtil.get<{ items: ClientSlim[]; total: number }>(
        `/panel/api/clients/list/paged?${queryParams.toString()}`,
        undefined,
        { silent: true }
      );

      if (res.success && res.obj) {
        setClients(res.obj.items || []);
        setTotal(res.obj.total || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [adminUsername, page, pageSize, searchText]);

  useEffect(() => {
    fetchClients();
    const timer = setInterval(() => {
      fetchClients(true);
    }, 10000);
    return () => clearInterval(timer);
  }, [page, pageSize, fetchClients]);

  const onShowQr = useCallback(async (row: any) => {
    const full = await hydrate(row.email);
    setQrClient(full ? { ...row, ...full.client, inboundIds: full.inboundIds } : row);
    setQrOpen(true);
  }, [hydrate]);

  const onShowInfo = useCallback(async (row: any) => {
    const full = await hydrate(row.email);
    setInfoClient(full ? { ...row, ...full.client, inboundIds: full.inboundIds } : row);
    setInfoOpen(true);
  }, [hydrate]);

  const onResetTraffic = useCallback(async (row: any) => {
    Modal.confirm({
      title: `${t('pages.inbounds.resetTraffic')} — ${row.email}`,
      content: t('pages.inbounds.resetTrafficContent'),
      okText: t('reset'),
      cancelText: t('cancel'),
      okButtonProps: { danger: true },
      onOk: async () => {
        const msg = await resetTraffic(row);
        if (msg?.success) {
          messageApi.success(t('success'));
          fetchClients();
          onClientChange();
        } else {
          messageApi.error(msg?.msg || t('somethingWentWrong'));
        }
      },
    });
  }, [t, resetTraffic, fetchClients, onClientChange, messageApi]);

  const onEdit = useCallback(async (row: any) => {
    setFormMode('edit');
    const full = await hydrate(row.email);
    const merged = full ? { ...row, ...full.client } : { ...row };
    setEditingClient(merged);
    const ids = full?.inboundIds ?? (Array.isArray(row.inboundIds) ? row.inboundIds : []);
    setEditingAttachedIds([...ids]);
    setEditingExternalLinks(Array.isArray(full?.externalLinks) ? [...full.externalLinks] : []);
    setFormOpen(true);
  }, [hydrate]);

  const onAdd = () => {
    setFormMode('add');
    setEditingClient(null);
    setEditingAttachedIds([]);
    setEditingExternalLinks([]);
    setFormOpen(true);
  };

  const onDelete = useCallback(async (row: any) => {
    const msg = await remove(row.email);
    if (msg?.success) {
      messageApi.success(t('success'));
      fetchClients();
      onClientChange();
    } else {
      messageApi.error(msg?.msg || t('somethingWentWrong'));
    }
  }, [remove, fetchClients, onClientChange, t, messageApi]);

  const onToggleEnable = useCallback(async (row: any, next: boolean) => {
    setTogglingEmail(row.email);
    try {
      const msg = await setEnable(row, next);
      if (msg?.success) {
        messageApi.success(next ? dict.toastEnabled : dict.toastDisabled);
        fetchClients();
      } else {
        messageApi.error(msg?.msg || t('somethingWentWrong'));
      }
    } finally {
      setTogglingEmail(null);
    }
  }, [setEnable, dict.toastEnabled, dict.toastDisabled, fetchClients, t, messageApi]);

  const onSave = async (
    payload: any,
    meta: any,
  ) => {
    if (!meta.isEdit) {
      if (payload.client) {
        payload.client.createdBy = adminUsername;
      } else {
        payload.createdBy = adminUsername;
      }
      
      const createMsg = await create(payload);
      if (!createMsg?.success) return createMsg;
      if (meta.email && meta.externalLinks && meta.externalLinks.length > 0) {
        const r = await setExternalLinks(meta.email, meta.externalLinks);
        if (!r?.success) return r;
      }
      fetchClients();
      onClientChange();
      return createMsg;
    } else {
      const updateMsg = await update(meta.email, payload);
      if (!updateMsg?.success) return updateMsg;
      const rawEmail = payload.email;
      const emailKey = typeof rawEmail === 'string' && rawEmail.trim() ? rawEmail.trim() : meta.email;
      if (Array.isArray(meta.attach) && meta.attach.length > 0) {
        const r = await attach(emailKey, meta.attach);
        if (!r?.success) return r;
      }
      if (Array.isArray(meta.detach) && meta.detach.length > 0) {
        const r = await detach(emailKey, meta.detach);
        if (!r?.success) return r;
      }
      if (meta.externalLinks) {
        const r = await setExternalLinks(emailKey, meta.externalLinks);
        if (!r?.success) return r;
      }
      fetchClients();
      onClientChange();
      return updateMsg;
    }
  };

  const clientBucket = useCallback((row: ClientSlim | null | undefined): Bucket | null => {
    if (!row) return null;
    const traffic = row.traffic || {};
    const used = (traffic.up || 0) + (traffic.down || 0);
    const total = row.totalGB || 0;
    const now = Date.now();
    const expired = (row.expiryTime ?? 0) > 0 && (row.expiryTime ?? 0) <= now;
    const exhausted = total > 0 && used >= total;
    if (expired || exhausted) return 'depleted';
    if (!row.enable) return 'deactive';
    const nearExpiry = (row.expiryTime ?? 0) > 0 && (row.expiryTime ?? 0) - now < (expireDiff || 0);
    const nearLimit = total > 0 && total - used < (trafficDiff || 0);
    if (nearExpiry || nearLimit) return 'expiring';
    return 'active';
  }, [expireDiff, trafficDiff]);

  const remainingLabel = (row: ClientSlim) => {
    const total = row.totalGB || 0;
    if (total <= 0) return '∞';
    const used = (row.traffic?.up || 0) + (row.traffic?.down || 0);
    const r = total - used;
    return r > 0 ? SizeFormatter.sizeFormat(r) : '0';
  };

  const remainingColor = (row: ClientSlim): string => {
    const total = row.totalGB || 0;
    if (total <= 0) return 'purple';
    const used = (row.traffic?.up || 0) + (row.traffic?.down || 0);
    const ratio = used / total;
    if (ratio >= 1) return 'red';
    if (ratio >= 0.85) return 'orange';
    return 'green';
  };

  const expiryLabel = useCallback((row: ClientSlim) => {
    if (!row.expiryTime) return '∞';
    if (row.expiryTime < 0) {
      const days = Math.round(row.expiryTime / -86400000);
      return `${t('pages.clients.delayedStart')}: ${days}d`;
    }
    return IntlUtil.formatDate(row.expiryTime, datepicker);
  }, [t, datepicker]);

  const expiryRelative = (row: ClientSlim) => {
    if (!row.expiryTime) return '';
    if (row.expiryTime < 0) {
      const days = Math.round(row.expiryTime / -86400000);
      return `${days}d`;
    }
    return IntlUtil.formatRelativeTime(row.expiryTime);
  };

  const expiryColor = (row: ClientSlim): string => {
    if (!row.expiryTime) return 'purple';
    if (row.expiryTime < 0) return 'blue';
    const now = Date.now();
    if (row.expiryTime <= now) return 'red';
    if (row.expiryTime - now < 86400 * 1000 * 3) return 'orange';
    return 'green';
  };

  const bucketBadgeStatus = (bucket: Bucket | null): 'success' | 'warning' | 'error' | 'default' => {
    switch (bucket) {
      case 'depleted': return 'error';
      case 'expiring': return 'warning';
      case 'active': return 'success';
      default: return 'default';
    }
  };

  const onlineSet = useMemo(() => new Set(onlines || []), [onlines]);
  const isOnline = useCallback((email: string) => !!email && onlineSet.has(email), [onlineSet]);

  const inboundsById = useMemo(() => {
    const map: Record<number, any> = {};
    for (const ib of inbounds) {
      map[ib.id] = ib;
    }
    return map;
  }, [inbounds]);

  const columns = useMemo<ColumnsType<any>>(() => [
    {
      title: t('pages.clients.actions'),
      key: 'actions',
      width: 180,
      render: (_v, record) => (
        <Space size={4}>
          <Tooltip title={t('pages.clients.qrCode')}>
            <Button size="small" type="text" style={{ fontSize: 16 }} icon={<QrcodeOutlined />} aria-label={t('pages.clients.qrCode')} onClick={() => onShowQr(record)} />
          </Tooltip>
          <Tooltip title={t('pages.clients.clientInfo')}>
            <Button size="small" type="text" style={{ fontSize: 16 }} icon={<InfoCircleOutlined />} aria-label={t('pages.clients.clientInfo')} onClick={() => onShowInfo(record)} />
          </Tooltip>
          <Tooltip title={t('pages.inbounds.resetTraffic')}>
            <Button size="small" type="text" style={{ fontSize: 16 }} icon={<RetweetOutlined />} aria-label={t('pages.inbounds.resetTraffic')} onClick={() => onResetTraffic(record)} />
          </Tooltip>
          <Tooltip title={t('edit')}>
            <Button size="small" type="text" style={{ fontSize: 16 }} icon={<EditOutlined />} aria-label={t('edit')} onClick={() => onEdit(record)} />
          </Tooltip>
          <Tooltip title={t('delete')}>
            <Popconfirm
              title={isFa ? 'آیا از حذف این کلاینت مطمئن هستید؟' : 'Are you sure you want to delete this client?'}
              onConfirm={() => onDelete(record)}
              okText={isFa ? 'بله' : 'Yes'}
              cancelText={isFa ? 'خیر' : 'No'}
              okButtonProps={{ danger: true }}
            >
              <Button size="small" type="text" danger style={{ fontSize: 16 }} icon={<DeleteOutlined />} aria-label={t('delete')} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: t('pages.clients.enabled'),
      key: 'enable',
      width: 80,
      render: (_v, record) => (
        <Switch
          checked={!!record.enable}
          size="small"
          loading={togglingEmail === record.email}
          onChange={(next) => onToggleEnable(record, next)}
        />
      ),
    },
    {
      title: t('pages.clients.online'),
      key: 'online',
      width: 90,
      render: (_v, record) => {
        const bucket = clientBucket(record);
        const lastOnline = record.traffic?.lastOnline ?? 0;
        const lastOnlineTitle = `${t('lastOnline')}: ${lastOnline > 0 ? IntlUtil.formatDate(lastOnline, datepicker) : '-'}`;
        if (bucket === 'depleted') return (
          <Tooltip title={lastOnlineTitle}>
            <Tag color="red">{t('depleted')}</Tag>
          </Tooltip>
        );
        if (record.enable && isOnline(record.email)) return (
          <Tag color="green" className="dot-tag"><span className="online-dot" />{t('pages.clients.online')}</Tag>
        );
        if (!record.enable) return <Tag>{t('disabled')}</Tag>;
        if (bucket === 'expiring') return <Tag color="orange">{t('depletingSoon')}</Tag>;
        return (
          <Tooltip title={lastOnlineTitle}>
            <Tag>{t('pages.clients.offline')}</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: t('pages.clients.client'),
      key: 'email',
      width: 220,
      render: (_v, record) => (
        <div className="email-cell">
          <span className="email">{record.email}</span>
          {record.subId && <span className="sub" title={record.subId}>{record.subId}</span>}
          {record.comment && <span className="sub" title={record.comment}>{record.comment}</span>}
        </div>
      ),
    },
    {
      title: t('pages.clients.attachedInbounds'),
      key: 'inboundIds',
      width: 170,
      render: (_v, record) => {
        const ids = record.inboundIds || [];
        if (ids.length === 0) return <span style={{ color: 'rgba(0,0,0,0.45)' }}>—</span>;
        const visible = ids.slice(0, INBOUND_CHIP_LIMIT);
        const overflow = ids.slice(INBOUND_CHIP_LIMIT);
        const chip = (id: number, compact: boolean) => {
          const ib = inboundsById[id];
          const proto = (ib?.protocol || '').toLowerCase();
          const color = INBOUND_PROTOCOL_COLORS[proto] ?? 'default';
          const compactLabel = formatInboundLabel(ib?.tag, ib?.remark);
          return (
            <Tooltip key={id} title={formatInboundLabel(ib?.tag, ib?.remark)}>
              <Tag color={color} style={{ margin: 2 }}>
                {compact ? compactLabel : formatInboundLabel(ib?.tag, ib?.remark)}
              </Tag>
            </Tooltip>
          );
        };
        return (
          <>
            {visible.map((id) => chip(id, true))}
            {overflow.length > 0 && (
              <Popover
                trigger="click"
                placement="bottomRight"
                content={
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 280, maxHeight: 280, overflowY: 'auto' }}>
                    {overflow.map((id) => chip(id, false))}
                  </div>
                }
              >
                <Tag color="default" style={{ margin: 2, cursor: 'pointer' }}>
                  +{overflow.length}
                </Tag>
              </Popover>
            )}
          </>
        );
      },
    },
    {
      title: t('pages.clients.traffic'),
      key: 'traffic',
      width: 250,
      render: (_v, record) => (
        <ClientTrafficCell
          up={record.traffic?.up}
          down={record.traffic?.down}
          total={record.totalGB}
          enabled={record.enable}
          trafficDiff={trafficDiff}
        />
      ),
    },
    {
      title: t('pages.clients.remaining'),
      key: 'remaining',
      width: 130,
      render: (_v, record) => <Tag color={remainingColor(record)}>{remainingLabel(record)}</Tag>,
    },
    {
      title: t('pages.clients.duration'),
      key: 'expiryTime',
      width: 130,
      render: (_v, record) => (
        <Tooltip title={expiryLabel(record)}>
          <Tag color={expiryColor(record)}>{record.expiryTime ? expiryRelative(record) : '∞'}</Tag>
        </Tooltip>
      ),
    },
  ], [t, togglingEmail, clientBucket, isOnline, inboundsById, datepicker, trafficDiff, isFa, expiryLabel, onDelete, onEdit, onResetTraffic, onShowInfo, onShowQr, onToggleEnable]);

  return (
    <div style={{ padding: isMobile ? '8px' : '16px', background: 'var(--ant-color-fill-quaternary)', borderRadius: '12px', margin: '8px 0', border: '1px solid var(--ant-color-border-secondary)' }}>
      {messageContextHolder}
      {/* Header Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Input
            size={isMobile ? "small" : "middle"}
            placeholder={dict.searchPlaceholder}
            prefix={<SearchOutlined style={{ color: 'var(--ant-color-text-placeholder)' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onPressEnter={() => { setPage(1); fetchClients(); }}
            style={{ width: isMobile ? 160 : 220, borderRadius: 8 }}
            allowClear
          />
          <Button
            type="primary"
            size={isMobile ? "small" : "middle"}
            icon={<SearchOutlined />}
            onClick={() => { setPage(1); fetchClients(); }}
            style={{ borderRadius: 8 }}
          />
          <Button
            size={isMobile ? "small" : "middle"}
            icon={<ReloadOutlined />}
            onClick={() => { setSearchText(''); setPage(1); fetchClients(); }}
            style={{ borderRadius: 8 }}
          />
        </div>

        <Button
          type="primary"
          size={isMobile ? "small" : "middle"}
          icon={<PlusOutlined />}
          onClick={onAdd}
          style={{ borderRadius: 8 }}
        >
          {dict.btnCreateClient}
        </Button>
      </div>

      {!isMobile ? (
        <Table<any>
          dataSource={clients}
          columns={columns}
          rowKey="email"
          loading={loading}
          size="small"
          scroll={{ x: 1000 }}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: total,
            size: 'small',
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
            showSizeChanger: true,
            pageSizeOptions: ['5', '10', '25', '50'],
          }}
          className="nested-clients-table"
        />
      ) : (
        <Spin spinning={loading}>
          <div className="client-cards">
            {clients.length === 0 && (
              <div className="card-empty">
                <TeamOutlined style={{ fontSize: 28, opacity: 0.5 }} />
                <div>{t('noData')}</div>
              </div>
            )}
            {clients.map((row) => {
              const bucket = clientBucket(row);
              return (
                <div key={row.email} className="client-card">
                  <div className="card-head">
                    {row.enable && bucket !== 'depleted' && isOnline(row.email)
                      ? <span className="online-dot" style={{ marginInlineEnd: 0 }} />
                      : <Badge status={bucketBadgeStatus(bucket)} />}
                    <span className="tag-name">{row.email}</span>
                    {bucket === 'depleted' && <Tag color="red" className="status-tag">{t('depleted')}</Tag>}
                    {bucket === 'expiring' && <Tag color="orange" className="status-tag">{t('depletingSoon')}</Tag>}
                    <div className="card-actions">
                      <Tooltip title={t('pages.clients.clientInfo')}>
                        <InfoCircleOutlined
                          className="row-action-trigger"
                          role="button"
                          tabIndex={0}
                          aria-label={t('pages.clients.clientInfo')}
                          onClick={() => onShowInfo(row)}
                        />
                      </Tooltip>
                      <Switch
                        checked={!!row.enable}
                        size="small"
                        loading={togglingEmail === row.email}
                        onChange={(next) => onToggleEnable(row, next)}
                      />
                      <Dropdown
                        trigger={['click']}
                        placement="bottomRight"
                        menu={{
                          items: [
                            {
                              key: 'qr',
                              label: <><QrcodeOutlined /> {t('pages.clients.qrCode')}</>,
                              onClick: () => onShowQr(row),
                            },
                            {
                              key: 'reset',
                              label: <><RetweetOutlined /> {t('pages.inbounds.resetTraffic')}</>,
                              onClick: () => onResetTraffic(row),
                            },
                            {
                              key: 'edit',
                              label: <><EditOutlined /> {t('edit')}</>,
                              onClick: () => onEdit(row),
                            },
                            {
                              key: 'delete',
                              danger: true,
                              label: <><DeleteOutlined /> {t('delete')}</>,
                              onClick: () => onDelete(row),
                            },
                          ],
                        }}
                      >
                        <Button type="text" size="small" className="row-action-trigger" icon={<MoreOutlined />} aria-label={t('more')} />
                      </Dropdown>
                    </div>
                  </div>
                  <ClientTrafficCell
                    compact
                    up={row.traffic?.up}
                    down={row.traffic?.down}
                    total={row.totalGB}
                    enabled={row.enable}
                    trafficDiff={trafficDiff}
                  />
                </div>
              );
            })}
            {total > 0 && (
              <div className="card-pagination" style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
                <Pagination
                  current={page}
                  pageSize={pageSize}
                  total={total}
                  size="small"
                  showSizeChanger={total > 5}
                  pageSizeOptions={['5', '10', '25', '50']}
                  hideOnSinglePage={total <= pageSize}
                  onChange={(p, s) => {
                    setPage(p);
                    if (s && s !== pageSize) setPageSize(s);
                  }}
                />
              </div>
            )}
          </div>
        </Spin>
      )}

      <Suspense fallback={null}>
        <LazyMount when={formOpen}>
          <ClientFormModal
            open={formOpen}
            mode={formMode}
            client={editingClient}
            attachedIds={editingAttachedIds}
            attachedExternalLinks={editingExternalLinks}
            inbounds={inbounds}
            adminInbounds={adminInbounds}
            tgBotEnable={tgBotEnable}
            groups={allGroups}
            save={onSave}
            resetTraffic={resetTraffic}
            onOpenChange={setFormOpen}
          />
        </LazyMount>

        <LazyMount when={infoOpen}>
          <ClientInfoModal
            open={infoOpen}
            client={infoClient}
            inboundsById={inboundsById}
            isOnline={infoClient ? isOnline(infoClient.email) : false}
            subSettings={subSettings}
            onOpenChange={setInfoOpen}
          />
        </LazyMount>

        <LazyMount when={qrOpen}>
          <ClientQrModal
            open={qrOpen}
            client={qrClient}
            inboundsById={inboundsById}
            subSettings={subSettings}
            onOpenChange={setQrOpen}
          />
        </LazyMount>
      </Suspense>
    </div>
  );
}

export default function ClientsAdminPage() {
  const { i18n, t } = useTranslation();
  const { isDark, isUltra, antdThemeConfig } = useTheme();
  const { isMobile } = useMediaQuery();
  const isFa = i18n.language?.startsWith('fa');

  const pageClass = useMemo(() => {
    const classes = ['clients-page'];
    if (isDark) classes.push('is-dark');
    if (isUltra) classes.push('is-ultra');
    return classes.join(' ');
  }, [isDark, isUltra]);

  // Dictionary for main UI
  const dict = {
    title: isFa ? 'مدیریت ادمین‌ها و کلاینت‌ها' : 'Clients & Admins Management',
    subTitle: isFa ? 'مشاهده و مدیریت کلاینت‌های ساخته شده توسط ادمین‌ها و همکاران' : 'Monitor and manage clients created by reseller partners & admins',
    searchPlaceholder: isFa ? 'جستجوی ادمین...' : 'Search admin...',
    colAdmin: isFa ? 'ادمین / همکار' : 'Reseller Admin',
    colClientsCount: isFa ? 'تعداد کلاینت‌ها' : 'Clients count',
    colVolume: isFa ? 'سهمیه حجم' : 'Volume Quota',
    colTrafficUsed: isFa ? 'کل حجم مصرفی' : 'Total Traffic Used',
    colExpiry: isFa ? 'تاریخ انقضا' : 'Expiry Date',
    colStatus: isFa ? 'وضعیت ادمین' : 'Admin Status',
    btnReload: isFa ? 'بروزرسانی' : 'Reload',
    unlimited: isFa ? 'نامحدود' : 'Unlimited',
    never: isFa ? 'هرگز' : 'Never',
    statsTotalAdmins: isFa ? 'کل ادمین‌ها' : 'Total Admins',
    statsActiveAdmins: isFa ? 'ادمین‌های فعال' : 'Active Admins',
    statsTotalClients: isFa ? 'کل کلاینت‌ها' : 'Total Clients',
    statsTrafficUsed: isFa ? 'کل حجم مصرفی همکاران' : 'Total Traffic Used',
  };

  const [admins, setAdmins] = useState<ResellerAdmin[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [subURI, setSubURI] = useState<string>('');
  const [subEnable, setSubEnable] = useState<boolean>(false);

  // Fetch settings (for subscription URI)
  const fetchSettings = async () => {
    const res = await HttpUtil.post('/panel/api/setting/defaultSettings', undefined, { silent: true });
    if (res.success && res.obj) {
      if (res.obj.subURI) {
        setSubURI(res.obj.subURI);
      }
      setSubEnable(!!res.obj.subEnable);
    }
  };

  // Fetch reseller admins
  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const res = await HttpUtil.get<ResellerAdmin[]>('/panel/api/admins/list', undefined, { silent: true });
      if (res.success && Array.isArray(res.obj)) {
        setAdmins(res.obj);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchAdmins();
  }, [fetchAdmins]);

  // Filter reseller admins by search text
  const filteredAdmins = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return admins;
    return admins.filter(
      (a) =>
        a.username.toLowerCase().includes(query) ||
        (a.remark && a.remark.toLowerCase().includes(query))
    );
  }, [admins, searchText]);

  // Compute overall stats
  const overallStats = useMemo(() => {
    const totalAdmins = admins.length;
    const activeAdmins = admins.filter((a) => a.enable).length;
    let totalClientsCount = 0;
    let overallTrafficBytes = 0;

    admins.forEach((a) => {
      totalClientsCount += a.clientsCount || 0;
      overallTrafficBytes += a.trafficUsedBytes || 0;
    });

    return {
      totalAdmins,
      activeAdmins,
      totalClientsCount,
      overallTrafficBytes: SizeFormatter.sizeFormat(overallTrafficBytes),
    };
  }, [admins]);

  // Table Columns for Reseller Admins
  const columns = [
    {
      title: dict.colAdmin,
      key: 'adminInfo',
      render: (record: ResellerAdmin) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <UserOutlined style={{ fontSize: '1.4rem', color: 'var(--ant-color-primary)', background: 'rgba(0,0,0,0.04)', padding: 8, borderRadius: '50%' }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--ant-color-text)' }}>
              {record.remark || record.username}
            </span>
            {record.remark && (
              <span style={{ fontSize: '0.8rem', color: 'var(--ant-color-text-secondary)' }}>
                @{record.username}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      title: dict.colClientsCount,
      key: 'clientsCount',
      render: (record: ResellerAdmin) => (
        <Tag color="cyan" style={{ borderRadius: 6, padding: '4px 8px', fontWeight: 600 }}>
          {record.clientsCount || 0}
        </Tag>
      ),
    },
    {
      title: dict.colVolume,
      key: 'volumeGB',
      render: (record: ResellerAdmin) => {
        if (!record.volumeGB || record.volumeGB <= 0) {
          return <Tag color="default">{dict.unlimited}</Tag>;
        }
        return (
          <span style={{ fontWeight: 600 }}>{record.volumeGB} GB</span>
        );
      },
    },
    {
      title: dict.colTrafficUsed,
      key: 'trafficUsedBytes',
      render: (record: ResellerAdmin) => (
        <span style={{ fontWeight: 600, color: 'var(--ant-color-text-secondary)' }}>
          {SizeFormatter.sizeFormat(record.trafficUsedBytes || 0)}
        </span>
      ),
    },
    {
      title: dict.colExpiry,
      key: 'expiryTime',
      render: (record: ResellerAdmin) => {
        if (!record.expiryTime) return <Tag color="default">{dict.never}</Tag>;
        const isExpired = record.expiryTime <= Date.now();
        const dateStr = new Date(record.expiryTime).toLocaleDateString(isFa ? 'fa-IR' : 'en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
        return (
          <Tag color={isExpired ? 'red' : 'green'} style={{ borderRadius: 6 }}>
            {dateStr}
          </Tag>
        );
      },
    },
    {
      title: dict.colStatus,
      key: 'enable',
      render: (record: ResellerAdmin) => (
        <Tag color={record.enable ? 'success' : 'error'} style={{ borderRadius: 6 }}>
          {record.enable ? (isFa ? 'فعال' : 'Active') : (isFa ? 'غیرفعال' : 'Deactive')}
        </Tag>
      ),
    },
  ];

  const [expandedAdmins, setExpandedAdmins] = useState<Set<string>>(new Set());
  const toggleExpand = (username: string) => {
    const next = new Set(expandedAdmins);
    if (next.has(username)) next.delete(username);
    else next.add(username);
    setExpandedAdmins(next);
  };

  return (
    <ConfigProvider theme={antdThemeConfig}>
      <Layout className={pageClass}>
        <AppSidebar />
        <Layout className="content-shell">
          <Layout.Content className="content-area" style={{ padding: isMobile ? '8px' : '16px' }}>
            {/* Overall Reseller Stats Cards */}
            <Card size="small" style={{ borderRadius: 12, marginBottom: 12, background: 'var(--ant-color-bg-container)' }}>
              <Row gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]} align="middle">
                <Col xs={12} sm={6}>
                  <Statistic
                    title={dict.statsTotalAdmins}
                    value={overallStats.totalAdmins}
                    prefix={<TeamOutlined style={{ color: 'var(--ant-color-primary)' }} />}
                    valueStyle={{ fontSize: isMobile ? '1.2rem' : '1.5rem' }}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic
                    title={dict.statsActiveAdmins}
                    value={overallStats.activeAdmins}
                    prefix={<CheckCircleOutlined style={{ color: 'var(--ant-color-success)' }} />}
                    valueStyle={{ fontSize: isMobile ? '1.2rem' : '1.5rem' }}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic
                    title={dict.statsTotalClients}
                    value={overallStats.totalClientsCount}
                    prefix={<DatabaseOutlined style={{ color: 'var(--ant-color-warning)' }} />}
                    valueStyle={{ fontSize: isMobile ? '1.2rem' : '1.5rem' }}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic
                    title={dict.statsTrafficUsed}
                    value={overallStats.overallTrafficBytes}
                    prefix={<PieChartOutlined style={{ color: 'var(--ant-color-error)' }} />}
                    valueStyle={{ fontSize: isMobile ? '1.2rem' : '1.5rem' }}
                  />
                </Col>
              </Row>
            </Card>

            {/* Filter and Content Card */}
            <Card
              title={
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: isMobile ? '1.1rem' : '1.2rem', fontWeight: 800 }}>{dict.title}</span>
                  {!isMobile && (
                    <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--ant-color-text-secondary)', marginTop: 2 }}>
                      {dict.subTitle}
                    </span>
                  )}
                </div>
              }
              style={{ borderRadius: 12, background: 'var(--ant-color-bg-container)' }}
              bodyStyle={{ padding: isMobile ? '12px' : '16px' }}
              extra={isMobile && <Button icon={<ReloadOutlined />} onClick={() => { setSearchText(''); fetchAdmins(); }} size="small" />}
            >
              {/* Filter bar */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <Input
                  placeholder={dict.searchPlaceholder}
                  prefix={<SearchOutlined style={{ color: 'var(--ant-color-text-placeholder)' }} />}
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  style={{ width: isMobile ? '100%' : 280, borderRadius: 8 }}
                  size={isMobile ? 'small' : 'middle'}
                  allowClear
                />
                {!isMobile && (
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={() => {
                      setSearchText('');
                      fetchAdmins();
                    }}
                    style={{ borderRadius: 8 }}
                  >
                    {dict.btnReload}
                  </Button>
                )}
              </div>

              {/* Main Table or Card List */}
              {!isMobile ? (
                <Table
                  dataSource={filteredAdmins}
                  columns={columns}
                  rowKey="username"
                  loading={loading}
                  expandable={{
                    expandedRowRender: (record) => (
                      <AdminClientsSubList
                        adminUsername={record.username}
                        adminInbounds={record.inbounds}
                        subEnable={subEnable}
                        subURI={subURI}
                        onClientChange={fetchAdmins}
                        isFa={isFa}
                      />
                    ),
                    rowExpandable: () => true,
                    expandIcon: ({ expanded, onExpand, record }) =>
                      expanded ? (
                        <Button
                          type="link"
                          size="small"
                          icon={<MinusOutlined />}
                          onClick={(e) => onExpand(record, e)}
                          style={{ color: 'var(--ant-color-error)' }}
                        />
                      ) : (
                        <Button
                          type="link"
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={(e) => onExpand(record, e)}
                          style={{ color: 'var(--ant-color-success)' }}
                        />
                      ),
                  }}
                  pagination={false}
                  size="small"
                  className="clients-admin-table"
                />
              ) : (
                <div className="admin-cards" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {filteredAdmins.map((admin) => (
                    <div key={admin.username} className="admin-card" style={{ background: 'var(--ant-color-bg-container)', border: '1px solid var(--ant-color-border-secondary)', borderRadius: 12, padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <UserOutlined style={{ fontSize: '1.2rem', color: 'var(--ant-color-primary)', background: 'rgba(0,0,0,0.04)', padding: 6, borderRadius: '50%' }} />
                          <div>
                            <div style={{ fontWeight: 700 }}>{admin.remark || admin.username}</div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>@{admin.username}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Tag color={admin.enable ? 'success' : 'error'} style={{ margin: 0, borderRadius: 6 }}>
                            {admin.enable ? (isFa ? 'فعال' : 'Active') : (isFa ? 'غیرفعال' : 'Deactive')}
                          </Tag>
                          <Button
                            size="small"
                            type="primary"
                            ghost={!expandedAdmins.has(admin.username)}
                            icon={expandedAdmins.has(admin.username) ? <MinusOutlined /> : <PlusOutlined />}
                            onClick={() => toggleExpand(admin.username)}
                            style={{ borderRadius: 6 }}
                          />
                        </div>
                      </div>
                      
                      <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.85rem' }}>
                        <div style={{ color: 'var(--ant-color-text-secondary)' }}>
                          {dict.colClientsCount}: <Tag color="cyan" style={{ borderRadius: 4, margin: 0 }}>{admin.clientsCount || 0}</Tag>
                        </div>
                        <div style={{ color: 'var(--ant-color-text-secondary)' }}>
                          {dict.colVolume}: <span style={{ fontWeight: 600 }}>{admin.volumeGB > 0 ? `${admin.volumeGB} GB` : dict.unlimited}</span>
                        </div>
                        <div style={{ color: 'var(--ant-color-text-secondary)' }}>
                          {dict.colTrafficUsed}: <span style={{ fontWeight: 600 }}>{SizeFormatter.sizeFormat(admin.trafficUsedBytes || 0)}</span>
                        </div>
                        <div style={{ color: 'var(--ant-color-text-secondary)' }}>
                          {dict.colExpiry}: <span style={{ fontWeight: 600 }}>{admin.expiryTime ? new Date(admin.expiryTime).toLocaleDateString(isFa ? 'fa-IR' : 'en-US') : dict.never}</span>
                        </div>
                      </div>

                      {expandedAdmins.has(admin.username) && (
                        <div style={{ marginTop: 12, borderTop: '1px dashed var(--ant-color-border-secondary)', paddingTop: 8 }}>
                          <AdminClientsSubList
                            adminUsername={admin.username}
                            adminInbounds={admin.inbounds}
                            subEnable={subEnable}
                            subURI={subURI}
                            onClientChange={fetchAdmins}
                            isFa={isFa}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                  {filteredAdmins.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 24, opacity: 0.5 }}>
                      <TeamOutlined style={{ fontSize: 32, marginBottom: 8 }} />
                      <div>{t('noData')}</div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </Layout.Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
