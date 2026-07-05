import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Tag,

  Tooltip,
  Row,
  Col,
  message,
  Checkbox,
  Switch,
  Dropdown,
  Statistic,


  Spin,
  Descriptions,
  ConfigProvider,
  Layout,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  SearchOutlined,
  ReloadOutlined,

  TeamOutlined,
  MoreOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  StopOutlined,
  SortAscendingOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { HttpUtil, SizeFormatter, IntlUtil } from '@/utils';
import { useTheme } from '@/hooks/useTheme';
import AppSidebar from '@/layouts/AppSidebar';
import '@/pages/clients/ClientsPage.css'; // Inherit all glorious dark theme styling!

interface ResellerAdmin {
  id: string;
  remark?: string;
  username: string;
  password?: string;
  volumeGB: number;
  days: number;
  webPath: string;
  inbounds: number[];
  createdAt: number;
  expiryTime: number;
  enable?: boolean;
  clientsCount?: number;
  trafficUsedBytes?: number;
}

interface InboundOption {
  id: number;
  remark: string;
  protocol: string;
  port: number;
}

export default function AdminAccessPage() {
  const { i18n } = useTranslation();
  const { isDark, isUltra, antdThemeConfig } = useTheme();
  const isFa = i18n.language?.startsWith('fa');

  const pageClass = useMemo(() => {
    const classes = ['clients-page'];
    if (isDark) classes.push('is-dark');
    if (isUltra) classes.push('is-ultra');
    return classes.join(' ');
  }, [isDark, isUltra]);

  // Multi-language text maps
  const dict = {
    title: isFa ? 'مدیریت همکاران و ادمین‌ها' : 'Resellers & Admins Management',
    addBtn: isFa ? 'ساخت ادمین همکار' : 'Create Reseller Admin',
    searchPlaceholder: isFa ? 'جستجوی نام، نام کاربری یا مسیر وب...' : 'Search remark, username or web path...',
    colRemark: isFa ? 'نام مستعار / توضیحات' : 'Remark / Display Name',
    colUsername: isFa ? 'نام کاربری' : 'Username',
    colQuota: isFa ? 'سقف حجم' : 'Quota',
    colExpiry: isFa ? 'زمان انقضا' : 'Expiry',
    colWebPath: isFa ? 'آدرس پورتال' : 'Portal URL',
    colInbounds: isFa ? 'اینباندهای مجاز' : 'Allowed Inbounds',
    colActions: isFa ? 'عملیات' : 'Actions',
    modalAddTitle: isFa ? 'افزودن ادمین همکار' : 'Create Reseller Admin',
    modalEditTitle: isFa ? 'ویرایش ادمین همکار' : 'Edit Reseller Admin',
    labelRemark: isFa ? 'نام مستعار (توضیحات)' : 'Remark (Display Name)',
    labelPassword: isFa ? 'رمز عبور' : 'Password',
    labelQuota: isFa ? 'سقف ترافیک کل (گیگابایت)' : 'Total Traffic Quota (GB)',
    labelQuotaHint: isFa ? 'مجموع ترافیک مصرفی تمام کلاینت‌های این ادمین (۰ برای نامحدود)' : "Sum of traffic used by this admin's clients (0 for unlimited)",
    labelDays: isFa ? 'مدت اعتبار اکانت (روز)' : 'Validity Period (Days)',
    labelDaysHint: isFa ? 'زمان اعتبار کل اکانت ادمین از زمان ساخت (۰ برای نامحدود)' : 'Admin account validity time from creation (0 for unlimited)',
    labelWebPath: isFa ? 'مسیر وب اختصاصی' : 'Custom Web Path',
    labelWebPathHint: isFa ? 'لینک پورتال اختصاصی برای ورود مستقیم' : 'Unique URL path for direct login (e.g., /portal/path)',
    labelInbounds: isFa ? 'اینباندهای مجاز' : 'Assigned Inbounds',
    labelInboundsHint: isFa ? 'کلاینت‌های این ادمین فقط در این اینباندها قابل تعریف خواهند بود' : 'This reseller will only be allowed to add clients inside these inbounds',
    btnGenerate: isFa ? 'تصادفی' : 'Randomize',
    btnCancel: isFa ? 'لغو' : 'Cancel',
    btnSubmit: isFa ? 'ثبت' : 'Submit',
    toastCopied: isFa ? 'لینک پورتال با موفقیت کپی شد!' : 'Portal link copied successfully!',
    confirmDelete: isFa ? 'آیا از حذف این ادمین همکار اطمینان دارید؟ تمامی دسترسی‌های پورتال او لغو خواهند شد.' : 'Are you sure you want to delete this reseller? Their access link will be revoked.',
    statusExpired: isFa ? 'منقضی شده' : 'Expired',
    statusActive: isFa ? 'فعال' : 'Active',
    statusDisabled: isFa ? 'غیرفعال' : 'Disabled',
    unlimited: isFa ? 'نامحدود' : 'Unlimited',
    daysSuffix: isFa ? ' روز باقیمانده' : ' days left',
    allInbounds: isFa ? 'همه اینباندها' : 'All Inbounds',
    noInbounds: isFa ? 'بدون اینباند' : 'No inbounds allowed',
    searchTip: isFa ? 'جستجو' : 'Search',
    reloadTip: isFa ? 'بروزرسانی لیست' : 'Reload',
    statsTotal: isFa ? 'کل ادمین‌ها' : 'Total Resellers',
    statsActive: isFa ? 'فعال' : 'Active',
    statsExpired: isFa ? 'منقضی شده' : 'Expired',
    statsDisabled: isFa ? 'غیرفعال' : 'Disabled',
    statsAllocated: isFa ? 'حجم کل همکاران' : 'Total Quota Pool',
    bulkDelete: isFa ? 'حذف گروهی' : 'Bulk Delete',
    bulkDisable: isFa ? 'غیرفعال‌سازی گروهی' : 'Bulk Disable',
    bulkEnable: isFa ? 'فعال‌سازی گروهی' : 'Bulk Enable',
    selectedCount: isFa ? 'انتخاب شده: {count} مورد' : '{count} items selected',
    selectAll: isFa ? 'انتخاب همه' : 'Select all',
    sortOldest: isFa ? 'قدیمی‌ترین' : 'Oldest first',
    sortNewest: isFa ? 'جدید‌ترین' : 'Newest first',
    sortQuota: isFa ? 'بیشترین سقف حجم' : 'Highest Quota',
    sortExpiry: isFa ? 'کمترین زمان باقیمانده' : 'Expiring soonest',
    detailsTitle: isFa ? 'جزئیات ادمین همکار' : 'Reseller Admin Details',
    detailsCreated: isFa ? 'تاریخ ساخت:' : 'Created At:',
    detailsRemaining: isFa ? 'زمان باقیمانده:' : 'Time Remaining:',
    detailsAllowedIb: isFa ? 'اینباندهای مجاز:' : 'Allowed Inbounds:',
    detailsLink: isFa ? 'لینک اختصاصی پورتال:' : 'Exclusive Portal Link:',
    detailsCopied: isFa ? 'کپی شد' : 'Copied',
    totalClients: isFa ? 'تعداد کلاینت‌ها' : 'Total Clients',
    trafficUsed: isFa ? 'حجم مصرف شده کلاینت‌ها' : 'Clients Traffic Consumed',
  };

  const [admins, setAdmins] = useState<ResellerAdmin[]>([]);
  const [inboundOptions, setInboundOptions] = useState<InboundOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [sortKey, setSortKey] = useState('createdAt:descend');

  // Multi selection
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<ResellerAdmin | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  
  // Info details modal
  const [infoAdmin, setInfoAdmin] = useState<ResellerAdmin | null>(null);
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  const [form] = Form.useForm();

  const fetchAdmins = async () => {
    setLoading(true);
    const res = await HttpUtil.get<ResellerAdmin[]>('/panel/api/admins/list', undefined, { silent: true });
    if (res.success && Array.isArray(res.obj)) {
      setAdmins(res.obj);
    }
    setLoading(false);
  };

  const fetchInbounds = async () => {
    const res = await HttpUtil.get<InboundOption[]>('/panel/api/inbounds/options', undefined, { silent: true });
    if (res.success && Array.isArray(res.obj)) {
      setInboundOptions(res.obj);
    }
  };

  useEffect(() => {
    fetchAdmins();
    fetchInbounds();
  }, []);

  const handleOpenAddModal = () => {
    setEditingAdmin(null);
    form.resetFields();
    form.setFieldsValue({
      remark: '',
      volumeGB: 0,
      days: 30,
      webPath: Math.random().toString(36).substring(2, 10),
      inbounds: inboundOptions.map(ib => ib.id),
      enable: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (admin: ResellerAdmin) => {
    setEditingAdmin(admin);
    form.setFieldsValue({
      remark: admin.remark,
      username: admin.username,
      password: admin.password,
      volumeGB: admin.volumeGB,
      days: admin.days,
      webPath: admin.webPath,
      inbounds: admin.inbounds,
      enable: admin.enable !== false,
    });
    setIsModalOpen(true);
  };

  const handleRandomizePath = () => {
    form.setFieldsValue({
      webPath: Math.random().toString(36).substring(2, 10)
    });
  };

  const handleDeleteAdmin = async (id: string) => {
    const res = await HttpUtil.post('/panel/api/admins/delete', { id }, { headers: { 'Content-Type': 'application/json' } });
    if (res.success) {
      fetchAdmins();
      setSelectedRowKeys(prev => prev.filter(k => k !== id));
    }
  };

  const handleFormSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingAdmin) {
        const res = await HttpUtil.post('/panel/api/admins/update', {
          id: editingAdmin.id,
          ...values
        }, { headers: { 'Content-Type': 'application/json' } });
        if (res.success) {
          setIsModalOpen(false);
          fetchAdmins();
          message.success(isFa ? 'اطلاعات ادمین بروزرسانی شد' : 'Admin updated successfully');
        } else {
          message.error(res.msg || (isFa ? 'خطا در بروزرسانی ادمین' : 'Failed to update admin'));
        }
      } else {
        const res = await HttpUtil.post('/panel/api/admins/add', values, { headers: { 'Content-Type': 'application/json' } });
        if (res.success) {
          setIsModalOpen(false);
          fetchAdmins();
          message.success(isFa ? 'ادمین با موفقیت ساخته شد' : 'Admin created successfully');
        } else {
          message.error(res.msg || (isFa ? 'خطا در ساخت ادمین' : 'Failed to create admin'));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const onToggleEnable = async (admin: ResellerAdmin, next: boolean) => {
    setTogglingId(admin.id);
    const res = await HttpUtil.post('/panel/api/admins/update', {
      ...admin,
      enable: next
    }, { headers: { 'Content-Type': 'application/json' } });
    if (res.success) {
      message.success(isFa ? 'وضعیت همکار با موفقیت ویرایش شد' : 'Reseller status updated successfully');
      fetchAdmins();
    }
    setTogglingId(null);
  };

  const handleCopyLink = (webPath: string) => {
    const host = window.location.origin;
    const basePath = window.X_UI_BASE_PATH || '/';
    const cleanBase = basePath.endsWith('/') ? basePath : basePath + '/';
    const link = `${host}${cleanBase}portal/${webPath}`;
    navigator.clipboard.writeText(link);
    message.success(dict.toastCopied);
  };

  const handleShowInfo = (admin: ResellerAdmin) => {
    setInfoAdmin(admin);
    setIsInfoOpen(true);
  };

  // Bulk operations
  const onBulkSetEnable = async (enable: boolean) => {
    setLoading(true);
    for (const id of selectedRowKeys) {
      const admin = admins.find(a => a.id === id);
      if (admin) {
        await HttpUtil.post('/panel/api/admins/update', {
          ...admin,
          enable
        }, { headers: { 'Content-Type': 'application/json' } });
      }
    }
    setSelectedRowKeys([]);
    message.success(isFa ? 'تغییرات با موفقیت بر روی همکاران اعمال شد' : 'Bulk reseller status updated successfully');
    fetchAdmins();
  };

  const onBulkDelete = () => {
    Modal.confirm({
      title: isFa ? 'حذف گروهی همکاران' : 'Bulk Delete Resellers',
      content: isFa 
        ? 'آیا از حذف گروهی همکاران انتخاب شده اطمینان دارید؟ تمامی دسترسی‌های پورتال آنها لغو خواهد شد.' 
        : 'Are you sure you want to delete the selected resellers? All their access links will be revoked.',
      okText: isFa ? 'بله، حذف کن' : 'Yes, delete',
      okType: 'danger',
      cancelText: dict.btnCancel,
      onOk: async () => {
        setLoading(true);
        for (const id of selectedRowKeys) {
          await HttpUtil.post('/panel/api/admins/delete', { id }, { headers: { 'Content-Type': 'application/json' } });
        }
        setSelectedRowKeys([]);
        message.success(isFa ? 'همکاران با موفقیت حذف شدند' : 'Selected resellers deleted successfully');
        fetchAdmins();
      }
    });
  };

  // Filtering & Sorting
  const filteredAdmins = useMemo(() => {
    const result = admins.filter(admin => {
      const term = searchText.toLowerCase().trim();
      if (!term) return true;
      const inboundsArray = Array.isArray(admin.inbounds) ? admin.inbounds : [];
      const inboundRemarks = inboundsArray.map(id => {
        const ib = inboundOptions.find(o => o.id === id);
        return ib ? (ib.remark || '').toLowerCase() : '';
      }).join(' ');

      return (
        (admin.remark || '').toLowerCase().includes(term) ||
        (admin.username || '').toLowerCase().includes(term) ||
        (admin.webPath || '').toLowerCase().includes(term) ||
        inboundRemarks.includes(term)
      );
    });

    // Sorting logic
    result.sort((a, b) => {
      if (sortKey === 'createdAt:ascend') return a.createdAt - b.createdAt;
      if (sortKey === 'createdAt:descend') return b.createdAt - a.createdAt;
      if (sortKey === 'volumeGB:descend') return b.volumeGB - a.volumeGB;
      if (sortKey === 'expiryTime:ascend') {
        const expiryA = a.expiryTime || Infinity;
        const expiryB = b.expiryTime || Infinity;
        return expiryA - expiryB;
      }
      return 0;
    });

    return result;
  }, [admins, searchText, sortKey, inboundOptions]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = admins.length;
    let active = 0;
    let expired = 0;
    let disabled = 0;
    let totalAllocatedGB = 0;

    admins.forEach(a => {
      totalAllocatedGB += (a.volumeGB || 0);
      if (a.enable === false) {
        disabled++;
      } else if (a.expiryTime && a.expiryTime < Date.now()) {
        expired++;
      } else {
        active++;
      }
    });

    return { total, active, expired, disabled, totalAllocatedGB };
  }, [admins]);

  const allSelected = filteredAdmins.length > 0 && selectedRowKeys.length === filteredAdmins.length;
  const someSelected = selectedRowKeys.length > 0 && selectedRowKeys.length < filteredAdmins.length;

  const selectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRowKeys(filteredAdmins.map(a => a.id));
    } else {
      setSelectedRowKeys([]);
    }
  };

  const toggleSelect = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedRowKeys(prev => [...prev, id]);
    } else {
      setSelectedRowKeys(prev => prev.filter(k => k !== id));
    }
  };

  const isExpired = (admin: ResellerAdmin) => {
    return admin.expiryTime && admin.expiryTime < Date.now();
  };

  const statusColor = (admin: ResellerAdmin) => {
    if (admin.enable === false) return 'gray';
    if (isExpired(admin)) return 'red';
    return 'green';
  };

  const getExpiryText = (admin: ResellerAdmin) => {
    if (!admin.expiryTime) return dict.unlimited;
    const diff = admin.expiryTime - Date.now();
    if (diff <= 0) return dict.statusExpired;
    const daysLeft = Math.ceil(diff / 86400000);
    return `${daysLeft}${dict.daysSuffix}`;
  };

  return (
    <ConfigProvider theme={antdThemeConfig}>
      <Layout className={pageClass}>
        <AppSidebar />
        <Layout className="content-shell">
          <Layout.Content className="content-area">
            {/* 1. Stats Bento Panel */}
      <Card size="small" style={{ borderRadius: 12, marginBottom: 12, background: 'var(--ant-color-bg-container)' }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={12} sm={8} md={4}>
            <Statistic
              title={dict.statsTotal}
              value={String(stats.total)}
              prefix={<TeamOutlined style={{ color: 'var(--ant-color-primary)', fontSize: '1.2rem', verticalAlign: 'middle' }} />}
            />
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Statistic
              title={dict.statsActive}
              value={String(stats.active)}
              prefix={<span className="dot dot-green" />}
            />
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Statistic
              title={dict.statsExpired}
              value={String(stats.expired)}
              prefix={<span className="dot dot-red" />}
            />
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Statistic
              title={dict.statsDisabled}
              value={String(stats.disabled)}
              prefix={<span className="dot dot-gray" />}
            />
          </Col>
          <Col xs={24} sm={16} md={8}>
            <Statistic
              title={dict.statsAllocated}
              value={stats.totalAllocatedGB > 0 ? `${stats.totalAllocatedGB} GB` : dict.unlimited}
              prefix={<span className="dot dot-blue" />}
            />
          </Col>
        </Row>
      </Card>

      {/* 2. Action & List Card */}
      <Card
        size="small"
        style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
        title={
          <div className="card-toolbar">
            {selectedRowKeys.length === 0 ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenAddModal}>
                {dict.addBtn}
              </Button>
            ) : (
              <Tag
                color="blue"
                closable
                onClose={() => setSelectedRowKeys([])}
                style={{ padding: '4px 8px', fontSize: 13 }}
              >
                {isFa ? `انتخاب شده: ${selectedRowKeys.length} مورد` : `${selectedRowKeys.length} selected`}
              </Tag>
            )}

            <Button icon={<ReloadOutlined />} onClick={fetchAdmins} />

            {selectedRowKeys.length > 0 && (
              <Dropdown
                trigger={['click']}
                placement="bottomRight"
                menu={{
                  items: [
                    {
                      key: 'enable',
                      icon: <CheckCircleOutlined />,
                      label: dict.bulkEnable,
                      onClick: () => onBulkSetEnable(true),
                    },
                    {
                      key: 'disable',
                      icon: <StopOutlined />,
                      label: dict.bulkDisable,
                      danger: true,
                      onClick: () => onBulkSetEnable(false),
                    },
                    { type: 'divider' },
                    {
                      key: 'delete',
                      icon: <DeleteOutlined />,
                      label: dict.bulkDelete,
                      danger: true,
                      onClick: onBulkDelete,
                    },
                  ]
                }}
              >
                <Button icon={<MoreOutlined />}>
                  {isFa ? 'عملیات گروهی' : 'Bulk Actions'}
                </Button>
              </Dropdown>
            )}
          </div>
        }
      >
        {/* Search, Sort & Clear Filters */}
        <div className="filter-bar" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <Input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={dict.searchPlaceholder}
            allowClear
            prefix={<SearchOutlined />}
            style={{ maxWidth: 320 }}
          />
          <Select
            value={sortKey}
            suffixIcon={<SortAscendingOutlined />}
            style={{ minWidth: 200 }}
            onChange={(value) => setSortKey(value)}
            options={[
              { value: 'createdAt:descend', label: dict.sortNewest },
              { value: 'createdAt:ascend', label: dict.sortOldest },
              { value: 'volumeGB:descend', label: dict.sortQuota },
              { value: 'expiryTime:ascend', label: dict.sortExpiry },
            ]}
          />
        </div>

        {/* List of Custom Designed Cards */}
        <Spin spinning={loading}>
          <div className="client-cards">
            {filteredAdmins.length > 0 && (
              <div className="card-bulk-bar" style={{ paddingLeft: 4 }}>
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={(e) => selectAll(e.target.checked)}
                >
                  {dict.selectAll}
                </Checkbox>
              </div>
            )}

            {filteredAdmins.length === 0 && (
              <div className="card-empty" style={{ padding: '40px 0', textAlign: 'center' }}>
                <TeamOutlined style={{ fontSize: 32, opacity: 0.5, marginBottom: 8 }} />
                <div style={{ opacity: 0.7 }}>{isFa ? 'هیچ همکاری یافت نشد' : 'No resellers found'}</div>
              </div>
            )}

            {filteredAdmins.map((row) => {
              const totalQuotaBytes = (row.volumeGB || 0) * 1024 * 1024 * 1024;
              const usedBytes = row.trafficUsedBytes || 0;
              const isSelected = selectedRowKeys.includes(row.id);
              
              // Progress ratio calculation
              const hasQuota = totalQuotaBytes > 0;
              const ratio = hasQuota ? usedBytes / totalQuotaBytes : 0;
              const progressPercentage = hasQuota ? Math.min(100, ratio * 100) : 100;
              
              return (
                <div key={row.id} className={`client-card${isSelected ? ' is-selected' : ''}`} style={{ transition: 'all 0.2s' }}>
                  <div className="card-head">
                    <Checkbox
                      checked={isSelected}
                      onChange={(e) => toggleSelect(row.id, e.target.checked)}
                    />
                    <span className={`dot dot-${statusColor(row)}`} />
                    <span 
                      className="tag-name" 
                      style={{ cursor: 'pointer', fontWeight: 600 }} 
                      onClick={() => handleShowInfo(row)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleShowInfo(row); }}
                    >
                      {row.remark || row.username}
                    </span>

                    {isExpired(row) && <Tag color="red" className="status-tag">{dict.statusExpired}</Tag>}
                    {row.enable === false && <Tag color="default" className="status-tag">{dict.statusDisabled}</Tag>}

                    <div className="card-actions">
                      <Tooltip title={isFa ? 'کپی لینک ورود پورتال' : 'Copy portal login link'}>
                        <CopyOutlined
                          className="row-action-trigger"
                          style={{ fontSize: 16, color: 'var(--ant-color-primary)' }}
                          onClick={() => handleCopyLink(row.webPath)}
                        />
                      </Tooltip>
                      <Tooltip title={isFa ? 'ویرایش همکار' : 'Edit reseller'}>
                        <EditOutlined
                          className="row-action-trigger"
                          style={{ fontSize: 16, color: '#faad14' }}
                          onClick={() => handleOpenEditModal(row)}
                        />
                      </Tooltip>

                      <Switch
                        checked={row.enable !== false}
                        size="small"
                        loading={togglingId === row.id}
                        onChange={(next) => onToggleEnable(row, next)}
                      />

                      <Dropdown
                        trigger={['click']}
                        placement="bottomRight"
                        menu={{
                          items: [
                            {
                              key: 'info',
                              label: <><InfoCircleOutlined /> {isFa ? 'جزئیات کامل' : 'Full Details'}</>,
                              onClick: () => handleShowInfo(row),
                            },
                            {
                              key: 'delete',
                              danger: true,
                              label: <><DeleteOutlined /> {isFa ? 'حذف ادمین همکار' : 'Delete Reseller'}</>,
                              onClick: () => {
                                Modal.confirm({
                                  title: isFa ? 'حذف همکار' : 'Delete Reseller',
                                  content: dict.confirmDelete,
                                  okText: isFa ? 'بله، حذف کن' : 'Yes, delete',
                                  okType: 'danger',
                                  cancelText: dict.btnCancel,
                                  onOk: () => handleDeleteAdmin(row.id)
                                });
                              }
                            }
                          ]
                        }}
                      >
                        <MoreOutlined className="row-action-trigger" style={{ fontSize: 18 }} />
                      </Dropdown>
                    </div>
                  </div>

                  {/* Quota Progress Bar */}
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', opacity: 0.8, marginBottom: 4 }}>
                      <span>
                        {isFa ? 'حجم مصرفی کل کلاینت‌ها: ' : 'Total Clients Consumed: '}
                        <strong>{SizeFormatter.sizeFormat(usedBytes)}</strong>
                      </span>
                      <span>
                        {hasQuota ? `${row.volumeGB} GB` : '∞'}
                      </span>
                    </div>

                    <div style={{
                      width: '100%',
                      height: '6px',
                      background: 'var(--ant-color-border-secondary)',
                      borderRadius: '3px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${progressPercentage}%`,
                        height: '100%',
                        background: hasQuota 
                          ? (ratio >= 0.9 ? 'var(--ant-color-error)' : 'var(--ant-color-primary)')
                          : 'linear-gradient(90deg, var(--ant-color-primary) 0%, #a855f7 100%)',
                        borderRadius: '3px',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>

                    {/* Meta stats below the bar */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: 8, fontSize: '11px', opacity: 0.6 }}>
                      <span>
                        👤 {row.clientsCount || 0} {isFa ? 'کلاینت' : 'clients'}
                      </span>
                      <span>•</span>
                      <span>
                        🌐 {Array.isArray(row.inbounds) ? row.inbounds.length : 0} {isFa ? 'اینباند مجاز' : 'allowed inbounds'}
                      </span>
                      <span>•</span>
                      <span>
                        ⏳ {getExpiryText(row)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Spin>
      </Card>

      {/* Add / Edit Admin Modal */}
      <Modal
        title={
          <span style={{ fontSize: '1.15rem', fontWeight: 'bold', color: 'var(--ant-color-primary)' }}>
            {editingAdmin ? dict.modalEditTitle : dict.modalAddTitle}
          </span>
        }
        open={isModalOpen}
        onOk={handleFormSubmit}
        onCancel={() => setIsModalOpen(false)}
        okText={dict.btnSubmit}
        cancelText={dict.btnCancel}
        width={600}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="remark"
            label={dict.labelRemark}
          >
            <Input placeholder={isFa ? 'مثلا: دالتون پورتال' : 'e.g. Daltoon Portal'} style={{ borderRadius: 6 }} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="username"
                label={dict.colUsername}
                rules={[
                  { required: true, message: isFa ? 'نام کاربری را وارد کنید' : 'Please input username' },
                  { pattern: /^[a-zA-Z0-9-_]+$/, message: isFa ? 'فقط حروف انگلیسی، اعداد و خط تیره بدون فاصله مجاز است' : 'Only alphanumeric characters, hyphens or underscores are allowed (no spaces)' }
                ]}
              >
                <Input placeholder="reseller1" style={{ borderRadius: 6 }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="password"
                label={dict.labelPassword}
                rules={[{ required: true, message: isFa ? 'رمز عبور را وارد کنید' : 'Please input password' }]}
              >
                <Input.Password placeholder="••••••••" style={{ borderRadius: 6 }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="volumeGB"
                label={dict.labelQuota}
                tooltip={dict.labelQuotaHint}
              >
                <InputNumber
                  style={{ width: '100%', borderRadius: 6 }}
                  min={0}
                  placeholder="0 (Unlimited)"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="days"
                label={dict.labelDays}
                tooltip={dict.labelDaysHint}
              >
                <InputNumber
                  style={{ width: '100%', borderRadius: 6 }}
                  min={0}
                  placeholder="0 (Unlimited)"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="webPath"
            label={dict.labelWebPath}
            tooltip={dict.labelWebPathHint}
            rules={[
              { required: true, message: isFa ? 'مسیر وب اختصاصی را وارد کنید' : 'Please input web path' },
              { pattern: /^[a-zA-Z0-9-_]+$/, message: isFa ? 'فقط حروف انگلیسی، اعداد و خط تیره مجاز است' : 'Only alphanumeric characters, hyphens or underscores are allowed' }
            ]}
          >
            <Input
              addonAfter={
                <Button type="link" size="small" style={{ padding: 0 }} onClick={handleRandomizePath}>
                  {dict.btnGenerate}
                </Button>
              }
              placeholder="e.g. reseller-portal-1"
              style={{ borderRadius: 6 }}
            />
          </Form.Item>

          <Form.Item
            name="inbounds"
            label={dict.labelInbounds}
            tooltip={dict.labelInboundsHint}
            rules={[{ required: true, message: isFa ? 'حداقل یک اینباند انتخاب کنید' : 'Please select at least one inbound' }]}
          >
            <Select
              mode="multiple"
              placeholder={isFa ? 'انتخاب اینباندهای همکار' : 'Select assigned inbounds'}
              style={{ width: '100%', borderRadius: 6 }}
              allowClear
            >
              {inboundOptions.map(ib => (
                <Select.Option key={ib.id} value={ib.id}>
                  <Tag color="blue" style={{ marginRight: 6 }}>{(ib.protocol || 'unknown').toUpperCase()}</Tag>
                  {ib.remark} (Port: {ib.port})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="enable"
            label={isFa ? 'وضعیت فعال بودن' : 'Account Status'}
            valuePropName="checked"
          >
            <Switch checkedChildren={isFa ? 'فعال' : 'Active'} unCheckedChildren={isFa ? 'غیرفعال' : 'Inactive'} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Info / Details Modal */}
      <Modal
        title={dict.detailsTitle}
        open={isInfoOpen}
        onCancel={() => setIsInfoOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setIsInfoOpen(false)}>
            {isFa ? 'بستن' : 'Close'}
          </Button>
        ]}
        width={550}
        destroyOnClose
      >
        {infoAdmin && (
          <div style={{ marginTop: 16 }}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label={dict.labelRemark}>
                <strong>{infoAdmin.remark || '-'}</strong>
              </Descriptions.Item>
              <Descriptions.Item label={dict.colUsername}>
                <strong>{infoAdmin.username}</strong>
              </Descriptions.Item>
              <Descriptions.Item label={dict.labelPassword}>
                <span style={{ fontFamily: 'monospace' }}>{infoAdmin.password || '••••••••'}</span>
              </Descriptions.Item>
              <Descriptions.Item label={dict.totalClients}>
                <Tag color="cyan">{infoAdmin.clientsCount || 0}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={dict.trafficUsed}>
                <Tag color="blue">{SizeFormatter.sizeFormat(infoAdmin.trafficUsedBytes || 0)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={dict.colQuota}>
                <Tag color={infoAdmin.volumeGB ? 'purple' : 'green'}>
                  {infoAdmin.volumeGB ? `${infoAdmin.volumeGB} GB` : dict.unlimited}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={dict.detailsCreated}>
                {infoAdmin.createdAt ? IntlUtil.formatDate(infoAdmin.createdAt) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label={dict.detailsRemaining}>
                <Tag color={isExpired(infoAdmin) ? 'red' : 'green'}>{getExpiryText(infoAdmin)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={dict.detailsAllowedIb}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {(Array.isArray(infoAdmin.inbounds) ? infoAdmin.inbounds : []).map(id => {
                    const ib = inboundOptions.find(o => o.id === id);
                    return ib ? (
                      <Tag key={id} color="geekblue">
                        {(ib.protocol || 'unknown').toUpperCase()}: {ib.remark}
                      </Tag>
                    ) : null;
                  })}
                </div>
              </Descriptions.Item>
              <Descriptions.Item label={dict.detailsLink}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', opacity: 0.8, overflowWrap: 'anywhere' }}>
                    {`${window.location.origin}${window.X_UI_BASE_PATH || '/'}portal/${infoAdmin.webPath}`}
                  </span>
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => handleCopyLink(infoAdmin.webPath)}
                  />
                </div>
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Modal>
          </Layout.Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
