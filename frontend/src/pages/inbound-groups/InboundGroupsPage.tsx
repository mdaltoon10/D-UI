import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Badge,
  Button,
  Card,
  Col,
  ConfigProvider,
  Dropdown,
  Input,
  Layout,
  Modal,
  Result,
  Row,
  Space,
  Spin,
  Statistic,
  Switch,
  Table,
  Tag,
  Tooltip,
  message,
} from 'antd';
import type { MenuProps, TableColumnsType } from 'antd';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CloudServerOutlined,
  CloudSyncOutlined,
  DeleteOutlined,
  EditOutlined,
  ForkOutlined,
  MoreOutlined,
  PieChartOutlined,
  PlusOutlined,
  SearchOutlined,
  TagsOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useTheme } from '@/hooks/useTheme';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { usePageTitle } from '@/hooks/usePageTitle';
import { HttpUtil, SizeFormatter } from '@/utils';
import { setMessageInstance } from '@/utils/messageBus';
import AppSidebar from '@/layouts/AppSidebar';
import {
  InboundGroupListSchema,
  type InboundGroupSummary,
} from '@/schemas/inboundGroup';
import { parseMsg } from '@/utils/zodValidate';
import { useInboundOptions } from '@/api/queries/useInboundOptions';
import { useNodesQuery } from '@/api/queries/useNodesQuery';
import InboundGroupModal, { type InboundGroupFormValues } from './InboundGroupModal';

const JSON_HEADERS = { headers: { 'Content-Type': 'application/json' } } as const;

async function fetchInboundGroups(): Promise<InboundGroupSummary[]> {
  try {
    const msg = await HttpUtil.get<InboundGroupSummary[]>('/panel/api/inbound-groups/list', undefined, { silent: true });
    if (!msg?.success) {
      if (msg?.msg) throw new Error(msg.msg);
      return [];
    }
    const validated = parseMsg(msg, InboundGroupListSchema, 'inbound-groups/list');
    if (Array.isArray(validated.obj)) return validated.obj;
    if (Array.isArray(msg.obj)) return msg.obj as InboundGroupSummary[];
    return [];
  } catch (err) {
    console.error('Failed to fetch inbound groups:', err);
    return [];
  }
}

export default function InboundGroupsPage() {
  usePageTitle();
  const { t } = useTranslation();
  const { isDark, isUltra, antdThemeConfig } = useTheme();
  const { isMobile } = useMediaQuery();
  const [modal, modalContextHolder] = Modal.useModal();
  const [messageApi, messageContextHolder] = message.useMessage();
  useEffect(() => { setMessageInstance(messageApi); }, [messageApi]);
  const queryClient = useQueryClient();

  const { data: inboundOptions = [] } = useInboundOptions();
  const { nodes = [] } = useNodesQuery();

  const groupsQuery = useQuery({
    queryKey: ['inbound-groups', 'list'],
    queryFn: fetchInboundGroups,
  });
  const groups = useMemo(() => (Array.isArray(groupsQuery.data) ? groupsQuery.data : []), [groupsQuery.data]);
  const loading = groupsQuery.isFetching;
  const fetched = groupsQuery.data !== undefined || groupsQuery.isError;
  const fetchError = groupsQuery.error ? (groupsQuery.error as Error).message : '';

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['inbound-groups'] });
  }, [queryClient]);

  const [searchQuery, setSearchQuery] = useState('');
  const [inboundGroupModalOpen, setInboundGroupModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedGroup, setSelectedGroup] = useState<InboundGroupSummary | null>(null);
  const [syncingGroupId, setSyncingGroupId] = useState<number | null>(null);

  const inboundMap = useMemo(() => {
    const map = new Map<number, (typeof inboundOptions)[0]>();
    inboundOptions.forEach((ib) => map.set(ib.id, ib));
    return map;
  }, [inboundOptions]);

  const nodeMap = useMemo(() => {
    const map = new Map<number, (typeof nodes)[0]>();
    nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [nodes]);

  const createMut = useMutation({
    mutationFn: (body: InboundGroupFormValues) =>
      HttpUtil.post('/panel/api/inbound-groups/create', body, JSON_HEADERS),
    onSuccess: (msg) => {
      if (msg?.success) {
        messageApi.success(t('pages.inboundGroups.createSuccess', { name: msg.obj?.name || '' }));
        setInboundGroupModalOpen(false);
        invalidate();
      }
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, values }: { id: number; values: InboundGroupFormValues }) =>
      HttpUtil.post(`/panel/api/inbound-groups/update/${id}`, values, JSON_HEADERS),
    onSuccess: (msg) => {
      if (msg?.success) {
        messageApi.success(t('pages.inboundGroups.updateSuccess', { name: selectedGroup?.name || '' }));
        setInboundGroupModalOpen(false);
        invalidate();
      }
    },
  });

  const enableMut = useMutation({
    mutationFn: ({ id, enable }: { id: number; enable: boolean }) =>
      HttpUtil.post(`/panel/api/inbound-groups/setEnable/${id}`, { enable }, JSON_HEADERS),
    onSuccess: () => invalidate(),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) =>
      HttpUtil.post(`/panel/api/inbound-groups/delete/${id}`, {}, JSON_HEADERS),
    onSuccess: (msg) => {
      if (msg?.success) {
        messageApi.success(t('pages.inboundGroups.deleteSuccess'));
        invalidate();
      }
    },
  });

  const syncToNodes = async (group: InboundGroupSummary) => {
    try {
      setSyncingGroupId(group.id);
      const msg = await HttpUtil.post<{ syncedNodes?: number }>(
        `/panel/api/inbound-groups/sync/${group.id}`,
        {},
        JSON_HEADERS,
      );
      if (msg?.success) {
        messageApi.success(
          t('pages.inboundGroups.syncSuccess', { count: msg.obj?.syncedNodes ?? group.nodeIds?.length ?? 0 }),
        );
      } else {
        messageApi.error(msg?.msg || t('somethingWentWrong'));
      }
    } catch (err: unknown) {
      messageApi.error(err instanceof Error ? err.message : t('somethingWentWrong'));
    } finally {
      setSyncingGroupId(null);
    }
  };

  const totals = useMemo(() => {
    let clients = 0;
    let online = 0;
    let up = 0;
    let down = 0;
    let totalTraffic = 0;
    const inbIdSet = new Set<number>();
    const nodeIdSet = new Set<number>();

    const list = Array.isArray(groups) ? groups : [];
    for (const g of list) {
      if (!g) continue;
      clients += g.clientCount || 0;
      online += g.onlineCount || 0;
      up += g.up || 0;
      down += g.down || 0;
      totalTraffic += g.trafficUsed || 0;
      (g.inboundIds || []).forEach((id) => inbIdSet.add(id));
      (g.nodeIds || []).forEach((id) => nodeIdSet.add(id));
    }
    return {
      groupCount: list.length,
      clients,
      online,
      inboundsCount: inbIdSet.size,
      nodesCount: nodeIdSet.size,
      up,
      down,
      totalTraffic,
    };
  }, [groups]);

  const filteredGroups = useMemo(() => {
    const list = Array.isArray(groups) ? groups : [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((g) => {
      if (!g) return false;
      if (g.name && g.name.toLowerCase().includes(q)) return true;
      if (g.remark && g.remark.toLowerCase().includes(q)) return true;
      if ((g.inboundTags || []).some((tag) => tag && tag.toLowerCase().includes(q))) return true;
      if ((g.nodeIds || []).some((nid) => {
        const n = nodeMap.get(nid);
        return n && ((n.name && n.name.toLowerCase().includes(q)) || (n.address && n.address.toLowerCase().includes(q)));
      })) return true;
      return false;
    });
  }, [groups, searchQuery, nodeMap]);

  const handleOpenCreate = () => {
    setSelectedGroup(null);
    setModalMode('create');
    setInboundGroupModalOpen(true);
  };

  const handleOpenEdit = (group: InboundGroupSummary) => {
    setSelectedGroup(group);
    setModalMode('edit');
    setInboundGroupModalOpen(true);
  };

  const handleModalSubmit = async (values: InboundGroupFormValues) => {
    if (modalMode === 'create') {
      await createMut.mutateAsync(values);
    } else if (selectedGroup) {
      await updateMut.mutateAsync({
        id: selectedGroup.id,
        values,
      });
    }
  };

  const handleToggleEnable = (group: InboundGroupSummary, checked: boolean) => {
    enableMut.mutate({ id: group.id, enable: checked });
  };

  const confirmDeleteGroup = (group: InboundGroupSummary) => {
    modal.confirm({
      title: t('pages.inboundGroups.deleteConfirmTitle', { name: group.name }),
      content: t('pages.inboundGroups.deleteConfirmContent'),
      okText: t('delete'),
      okType: 'danger',
      cancelText: t('cancel'),
      onOk: () => deleteMut.mutate(group.id),
    });
  };

  const getActionMenuItems = (record: InboundGroupSummary): MenuProps['items'] => [
    {
      key: 'sync',
      icon: <CloudSyncOutlined className="text-blue-500" />,
      label: (
        <div className="flex items-center justify-between gap-4">
          <span className="font-medium text-blue-600 dark:text-blue-400">
            {t('pages.inboundGroups.syncToNodes')}
          </span>
          <Tag color="blue" className="m-0 text-[10px]">
            {record.nodeIds?.length || 0} Nodes
          </Tag>
        </div>
      ),
      disabled: (record.nodeIds?.length || 0) === 0 || syncingGroupId === record.id,
      onClick: () => syncToNodes(record),
    },
    { type: 'divider' },
    {
      key: 'edit',
      icon: <EditOutlined />,
      label: t('pages.inboundGroups.editGroup'),
      onClick: () => handleOpenEdit(record),
    },
    { type: 'divider' },
    {
      key: 'deleteGroup',
      icon: <DeleteOutlined />,
      danger: true,
      label: t('delete'),
      onClick: () => confirmDeleteGroup(record),
    },
  ];

  const columns: TableColumnsType<InboundGroupSummary> = [
    {
      title: t('pages.clients.actions'),
      key: 'actions',
      width: 60,
      align: 'center',
      render: (_: unknown, record: InboundGroupSummary) => (
        <Dropdown
          menu={{ items: getActionMenuItems(record) }}
          trigger={['click']}
          placement="bottomRight"
        >
          <Button
            aria-label={t('more')}
            size="small"
            type="text"
            style={{ fontSize: 16 }}
            icon={<MoreOutlined />}
          />
        </Dropdown>
      ),
    },
    {
      title: t('pages.inboundGroups.name'),
      dataIndex: 'name',
      key: 'name',
      render: (name: string, row: InboundGroupSummary) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Tag color="geekblue" style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
              {name}
            </Tag>
            {row.enable === false && (
              <Badge status="error" text={<span className="text-xs text-neutral-400">{t('disabled')}</span>} />
            )}
          </div>
          {row.remark && (
            <span className="text-xs text-neutral-400">{row.remark}</span>
          )}
        </div>
      ),
    },
    {
      title: t('pages.inboundGroups.assignedInbounds'),
      dataIndex: 'inboundIds',
      key: 'inboundIds',
      render: (ids: number[] = []) => {
        if (!ids || ids.length === 0) {
          return (
            <Tag color="default" className="text-xs">
              {t('pages.inboundGroups.allInbounds')} (Master)
            </Tag>
          );
        }
        return (
          <div className="flex flex-wrap gap-1 max-w-xs">
            {ids.map((id) => {
              const ib = inboundMap.get(id);
              const proto = ib?.protocol ? ib.protocol.toUpperCase() : 'IB';
              const port = ib?.port ? `:${ib.port}` : '';
              const tag = ib?.tag || `#${id}`;
              return (
                <Tooltip key={id} title={`${ib?.remark || tag} (${proto}${port})`}>
                  <Tag color="cyan" className="text-xs font-mono m-0 flex items-center gap-1">
                    <ForkOutlined className="text-[10px]" />
                    <span>{tag}</span>
                    <span className="text-[10px] opacity-75 font-sans">[{proto}{port}]</span>
                  </Tag>
                </Tooltip>
              );
            })}
          </div>
        );
      },
    },
    {
      title: t('pages.inboundGroups.assignedNodes'),
      dataIndex: 'nodeIds',
      key: 'nodeIds',
      render: (ids: number[] = [], row: InboundGroupSummary) => {
        if (!ids || ids.length === 0) {
          return <span className="text-xs text-neutral-400 italic">No nodes</span>;
        }
        return (
          <div className="flex flex-wrap items-center gap-1 max-w-xs">
            {ids.map((id) => {
              const n = nodeMap.get(id);
              const isOnline = n?.status === 'online';
              const name = n?.name || `Node #${id}`;
              return (
                <Tooltip key={id} title={`${name} - ${n?.address || 'Remote'}:${n?.port || ''}`}>
                  <Tag
                    color={isOnline ? 'purple' : 'default'}
                    className="text-xs m-0 flex items-center gap-1 px-1.5 py-0.5"
                  >
                    <Badge status={isOnline ? 'processing' : 'default'} />
                    <CloudServerOutlined className="text-[10px]" />
                    <span>{name}</span>
                  </Tag>
                </Tooltip>
              );
            })}
            <Button
              type="text"
              size="small"
              icon={<CloudSyncOutlined spin={syncingGroupId === row.id} />}
              onClick={() => syncToNodes(row)}
              className="text-xs p-1 h-6 text-blue-500 hover:text-blue-600"
              title={t('pages.inboundGroups.syncToNodes')}
            />
          </div>
        );
      },
    },
    {
      title: t('pages.inboundGroups.clientCount'),
      dataIndex: 'clientCount',
      key: 'clientCount',
      width: 120,
      render: (cnt: number, row: InboundGroupSummary) => (
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-sm">{cnt || 0}</span>
          {row.onlineCount ? (
            <span className="text-[11px] text-green-500 font-medium">
              ({row.onlineCount} {t('pages.inboundGroups.online')})
            </span>
          ) : null}
        </div>
      ),
    },
    {
      title: t('pages.inboundGroups.upload'),
      dataIndex: 'up',
      key: 'up',
      width: 130,
      render: (val: number) => (
        <span className="text-emerald-500 flex items-center gap-1 font-mono text-xs">
          <ArrowUpOutlined className="text-[10px]" />
          {SizeFormatter.sizeFormat(val || 0)}
        </span>
      ),
    },
    {
      title: t('pages.inboundGroups.download'),
      dataIndex: 'down',
      key: 'down',
      width: 130,
      render: (val: number) => (
        <span className="text-sky-500 flex items-center gap-1 font-mono text-xs">
          <ArrowDownOutlined className="text-[10px]" />
          {SizeFormatter.sizeFormat(val || 0)}
        </span>
      ),
    },
    {
      title: t('pages.inboundGroups.totalTraffic'),
      dataIndex: 'trafficUsed',
      key: 'trafficUsed',
      width: 150,
      render: (val: number) => (
        <span className="font-semibold text-sm font-mono">
          {SizeFormatter.sizeFormat(val || 0)}
        </span>
      ),
    },
    {
      title: t('pages.inboundGroups.status'),
      key: 'enable',
      width: 90,
      align: 'center',
      render: (_: unknown, row: InboundGroupSummary) => (
        <Switch
          size="small"
          checked={row.enable !== false}
          onChange={(checked) => handleToggleEnable(row, checked)}
        />
      ),
    },
  ];

  const pageClass = useMemo(() => {
    const classes = ['inbound-groups-page', 'groups-page'];
    if (isDark) classes.push('is-dark');
    if (isUltra) classes.push('is-ultra');
    return classes.join(' ');
  }, [isDark, isUltra]);

  return (
    <ConfigProvider theme={antdThemeConfig}>
      {modalContextHolder}
      {messageContextHolder}
      <Layout className={pageClass}>
        <AppSidebar />
        <Layout className="content-shell">
          <Layout.Content id="content-layout" className="content-area">
            <Spin spinning={!fetched} delay={200} description={t('loading')} size="large">
              {!fetched ? (
                <div className="loading-spacer" />
              ) : fetchError ? (
                <Result
                  status="error"
                  title={t('somethingWentWrong')}
                  subTitle={fetchError}
                  extra={
                    <Button type="primary" loading={loading} onClick={() => groupsQuery.refetch()}>
                      {t('refresh')}
                    </Button>
                  }
                />
              ) : (
                <Row gutter={[isMobile ? 8 : 16, isMobile ? 8 : 12]}>
                  {/* Summary Card */}
                  <Col span={24}>
                    <Card size="small" hoverable className="summary-card">
                      <Row gutter={[16, isMobile ? 16 : 12]}>
                        <Col xs={12} sm={12} md={6}>
                          <Statistic
                            title={t('pages.inboundGroups.totalGroups')}
                            value={String(totals.groupCount)}
                            prefix={<TagsOutlined />}
                          />
                        </Col>
                        <Col xs={12} sm={12} md={6}>
                          <Statistic
                            title={t('pages.inboundGroups.totalGroupedClients')}
                            value={String(totals.clients)}
                            prefix={<TeamOutlined />}
                            suffix={
                              totals.online > 0 ? (
                                <span className="text-xs text-emerald-500 font-medium ml-1">
                                  ({totals.online} {t('pages.inboundGroups.online')})
                                </span>
                              ) : undefined
                            }
                          />
                        </Col>
                        <Col xs={12} sm={12} md={6}>
                          <Statistic
                            title={t('pages.inboundGroups.totalUpDown')}
                            value={0}
                            formatter={() => (
                              <span>
                                <ArrowUpOutlined /> {SizeFormatter.sizeFormat(totals.up)}
                                {' / '}
                                <ArrowDownOutlined /> {SizeFormatter.sizeFormat(totals.down)}
                              </span>
                            )}
                          />
                        </Col>
                        <Col xs={12} sm={12} md={6}>
                          <Statistic
                            title={t('pages.inboundGroups.totalTraffic')}
                            value={SizeFormatter.sizeFormat(totals.totalTraffic)}
                            prefix={<PieChartOutlined />}
                          />
                        </Col>
                      </Row>
                    </Card>
                  </Col>

                  {/* Main Inbound Groups Card */}
                  <Col span={24}>
                    <Card
                      size="small"
                      hoverable
                      title={
                        <div className="card-toolbar flex items-center justify-between gap-2 flex-wrap">
                          <Space size="middle">
                            <Button
                              aria-label={t('pages.inboundGroups.addGroup')}
                              type="primary"
                              icon={<PlusOutlined />}
                              onClick={handleOpenCreate}
                            >
                              {!isMobile && t('pages.inboundGroups.addGroup')}
                            </Button>
                          </Space>
                          <Input
                            prefix={<SearchOutlined className="text-neutral-400" />}
                            placeholder={t('pages.inboundGroups.searchPlaceholder')}
                            allowClear
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ width: isMobile ? '100%' : 240 }}
                            size="middle"
                          />
                        </div>
                      }
                    >
                      <Table<InboundGroupSummary>
                        dataSource={filteredGroups}
                        columns={columns}
                        rowKey="id"
                        size="small"
                        pagination={false}
                        loading={loading}
                        scroll={{ x: 'max-content' }}
                        locale={{
                          emptyText: (
                            <div className="card-empty">
                              <ForkOutlined style={{ fontSize: 32, marginBottom: 8 }} />
                              <div>{t('noData')}</div>
                            </div>
                          ),
                        }}
                      />
                    </Card>
                  </Col>
                </Row>
              )}
            </Spin>
          </Layout.Content>
        </Layout>

        {/* Modal */}
        <InboundGroupModal
          open={inboundGroupModalOpen}
          mode={modalMode}
          group={selectedGroup}
          inboundOptions={inboundOptions}
          nodes={nodes}
          submitting={createMut.isPending || updateMut.isPending}
          onClose={() => setInboundGroupModalOpen(false)}
          onSubmit={handleModalSubmit}
        />
      </Layout>
    </ConfigProvider>
  );
}
