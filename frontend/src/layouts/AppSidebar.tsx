import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Drawer, Layout, Menu } from 'antd';
import type { MenuProps } from 'antd';
import {
  ApiOutlined,
  CloseOutlined,
  CloudServerOutlined,
  ClusterOutlined,
  CodeOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  ExportOutlined,
  GithubOutlined,
  GlobalOutlined,
  HeartOutlined,
  ImportOutlined,
  LogoutOutlined,
  MailOutlined,
  MenuOutlined,
  MessageOutlined,
  MoonFilled,
  MoonOutlined,
  ReadOutlined,
  SafetyOutlined,
  SettingOutlined,
  SunOutlined,
  SwapOutlined,
  TagsOutlined,
  TeamOutlined,
  ToolOutlined,
} from '@ant-design/icons';

import { HttpUtil } from '@/utils';
import { formatPanelVersion } from '@/lib/panel-version';
import { pauseAnimationsUntilLeave, useTheme } from '@/hooks/useTheme';
import { useAllSettings } from '@/api/queries/useAllSettings';
import './AppSidebar.css';

const SIDEBAR_COLLAPSED_KEY = 'isSidebarCollapsed';
const DONATE_URL = 'https://donate.mDaltoon.dev/';
const DOCS_URL = 'https://docs.mDaltoon.dev/';
const REPO_URL = 'https://github.com/mdaltoon10/D-UI';
const LOGOUT_KEY = '__logout__';

type IconName = 'dashboard' | 'inbound' | 'team' | 'groups' | 'setting' | 'tool' | 'cluster' | 'hosts' | 'logout' | 'apidocs' | 'outbound' | 'routing' | 'security';

const iconByName: Record<IconName, ComponentType> = {
  dashboard: DashboardOutlined,
  inbound: ImportOutlined,
  team: TeamOutlined,
  groups: TagsOutlined,
  setting: SettingOutlined,
  tool: ToolOutlined,
  cluster: ClusterOutlined,
  hosts: GlobalOutlined,
  logout: LogoutOutlined,
  apidocs: ApiOutlined,
  outbound: ExportOutlined,
  routing: SwapOutlined,
  security: SafetyOutlined,
};

function readCollapsed(): boolean {
  try {
    return JSON.parse(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) || 'false');
  } catch {
    return false;
  }
}

function DonateButton({ ariaLabel }: { ariaLabel: string }) {
  return (
    <a
      href={DONATE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="sidebar-donate"
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <HeartOutlined />
    </a>
  );
}

function DocsButton({ ariaLabel }: { ariaLabel: string }) {
  return (
    <a
      href={DOCS_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="sidebar-docs"
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <ReadOutlined />
    </a>
  );
}

function VersionBadge({ version, collapsed }: { version: string; collapsed?: boolean }) {
  if (!version) return null;
  const label = formatPanelVersion(version);
  return (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`sider-version${collapsed ? ' is-collapsed' : ''}`}
      aria-label={`GitHub ${label}`}
      title={label}
    >
      <GithubOutlined />
      {!collapsed && <span className="sider-version-text">{label}</span>}
    </a>
  );
}

function ThemeCycleButton({ id, isDark, isUltra, onCycle, ariaLabel }: {
  id: string;
  isDark: boolean;
  isUltra: boolean;
  onCycle: () => void;
  ariaLabel: string;
}) {
  const icon = !isDark ? <SunOutlined /> : !isUltra ? <MoonOutlined /> : <MoonFilled />;
  return (
    <button
      id={id}
      type="button"
      className="sidebar-theme-cycle"
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={onCycle}
    >
      {icon}
    </button>
  );
}

function getDeveloperByText(lng: string): string {
  const code = lng.toLowerCase();
  if (code.startsWith('fa')) {
    return 'توسعه دهنده';
  }
  if (code.startsWith('ar')) {
    return 'تطوير بواسطة';
  }
  if (code.startsWith('ru')) {
    return 'Разработчик';
  }
  if (code.startsWith('zh')) {
    return '开发者';
  }
  if (code.startsWith('tr')) {
    return 'Geliştirici';
  }
  if (code.startsWith('es')) {
    return 'Desarrollador';
  }
  if (code.startsWith('pt')) {
    return 'Desenvolvedor';
  }
  if (code.startsWith('vi')) {
    return 'Nhà phát triển';
  }
  if (code.startsWith('ja')) {
    return '開発者';
  }
  if (code.startsWith('uk')) {
    return 'Розробник';
  }
  if (code.startsWith('id')) {
    return 'Pengembang';
  }
  return 'Developer By';
}

function getAdminAccessText(lng: string): string {
  const code = lng.toLowerCase();
  if (code.startsWith('fa')) {
    return 'دسترسی ادمین';
  }
  if (code.startsWith('ar')) {
    return 'صلاحية الأدمن';
  }
  if (code.startsWith('ru')) {
    return 'Доступ администратора';
  }
  if (code.startsWith('zh-tw') || code.startsWith('zh-hk')) {
    return '管理員權限';
  }
  if (code.startsWith('zh')) {
    return '管理员权限';
  }
  if (code.startsWith('tr')) {
    return 'Admin Erişimi';
  }
  if (code.startsWith('es')) {
    return 'Acceso de administrador';
  }
  if (code.startsWith('pt')) {
    return 'Acesso do Administrador';
  }
  if (code.startsWith('vi')) {
    return 'Quyền truy cập Admin';
  }
  if (code.startsWith('ja')) {
    return '管理者権限';
  }
  if (code.startsWith('uk')) {
    return 'Доступ адміністратора';
  }
  if (code.startsWith('id')) {
    return 'Akses Admin';
  }
  return 'Admin Access';
}

export default function AppSidebar() {
  const { t, i18n } = useTranslation();
  const { isDark, isUltra, toggleTheme, toggleUltra } = useTheme();
  const navigate = useNavigate();
  const { pathname, hash } = useLocation();
  const { allSetting } = useAllSettings();
  const showSubFormats = !!(allSetting.subJsonEnable || allSetting.subClashEnable);

  const [collapsed, setCollapsed] = useState<boolean>(() => readCollapsed());
  const [drawerOpen, setDrawerOpen] = useState(false);

  const currentAdmin = useMemo(() => {
    const raw = localStorage.getItem('daltoon_current_admin');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, []);

  const brandName = useMemo(() => {
    if (currentAdmin?.remark) return currentAdmin.remark;
    if (currentAdmin?.username) return currentAdmin.username;
    return 'Daltoon-UI';
  }, [currentAdmin]);

  const currentTheme: 'light' | 'dark' = isDark ? 'dark' : 'light';
  const panelVersion = window.X_UI_CUR_VER || 'v1.0.3';

  const tabs = useMemo<{ key: string; icon: IconName; title: string }[]>(() => {
    const allTabs = [
      { key: '/', icon: 'dashboard' as IconName, title: t('menu.dashboard') },
      { key: '/inbounds', icon: 'inbound' as IconName, title: t('menu.inbounds') },
      { key: '/clients', icon: 'team' as IconName, title: t('menu.clients') },
      { key: '/groups', icon: 'groups' as IconName, title: t('menu.groups') },
      { key: '/nodes', icon: 'cluster' as IconName, title: t('menu.nodes') },
      { key: '/hosts', icon: 'hosts' as IconName, title: t('menu.hosts') },
      { key: 'admin-access-parent', icon: 'security' as IconName, title: getAdminAccessText(i18n.language || 'en-US') },
      { key: '/outbound', icon: 'outbound' as IconName, title: t('menu.outbounds') },
      { key: '/routing', icon: 'routing' as IconName, title: t('menu.routing') },
      { key: '/settings', icon: 'setting' as IconName, title: t('menu.settings') },
      { key: '/xray', icon: 'tool' as IconName, title: t('menu.xray') },
      { key: '/api-docs', icon: 'apidocs' as IconName, title: t('menu.apiDocs') },
      { key: LOGOUT_KEY, icon: 'logout' as IconName, title: t('logout') },
    ];
    const currentAdminRaw = localStorage.getItem('daltoon_current_admin');
    const isReseller = !!(currentAdminRaw || (typeof window !== 'undefined' && window.X_UI_IS_RESELLER));
    if (isReseller) {
      // Reseller has ONLY access to Dashboard, Clients, and Logout
      return allTabs.filter(tab => tab.key === '/' || tab.key === '/clients' || tab.key === LOGOUT_KEY);
    }
    return allTabs;
  }, [t, i18n.language]);

  const navItems = useMemo(() => tabs.filter((tab) => tab.icon !== 'logout'), [tabs]);
  const utilItems = useMemo(() => tabs.filter((tab) => tab.icon === 'logout'), [tabs]);

  const settingsChildren = useMemo<NonNullable<MenuProps['items']>>(() => {
    const children: NonNullable<MenuProps['items']> = [
      { key: '/settings#general', icon: <SettingOutlined />, label: t('pages.settings.panelSettings') },
      { key: '/settings#security', icon: <SafetyOutlined />, label: t('pages.settings.securitySettings') },
      { key: '/settings#telegram', icon: <MessageOutlined />, label: t('pages.settings.TGBotSettings') },
      { key: '/settings#email', icon: <MailOutlined />, label: t('pages.settings.emailSettings') },
      { key: '/settings#subscription', icon: <CloudServerOutlined />, label: t('pages.settings.subSettings') },
    ];
    if (showSubFormats) {
      children.push({ key: '/settings#subscription-formats', icon: <CodeOutlined />, label: 'Sub Formats' });
    }
    return children;
  }, [t, showSubFormats]);

  const xrayChildren = useMemo<NonNullable<MenuProps['items']>>(() => [
    { key: '/xray#basic', icon: <SettingOutlined />, label: t('pages.xray.basicTemplate') },
    { key: '/xray#balancer', icon: <ClusterOutlined />, label: t('pages.xray.Balancers') },
    { key: '/xray#dns', icon: <DatabaseOutlined />, label: 'DNS' },
    { key: '/xray#advanced', icon: <CodeOutlined />, label: t('pages.xray.advancedTemplate') },
  ], [t]);

  const adminChildren = useMemo<NonNullable<MenuProps['items']>>(() => {
    const isFa = i18n.language?.startsWith('fa');
    return [
      { key: '/admin-access', icon: <TeamOutlined />, label: isFa ? 'لیست ادمین‌ها' : 'Admins List' },
      { key: '/clients-admin', icon: <SafetyOutlined />, label: isFa ? 'کلاینت‌های ادمین' : 'Clients Admin' },
    ];
  }, [i18n.language]);

  const settingsActive = pathname === '/settings';
  const xrayActive = pathname === '/xray';
  const adminActive = pathname === '/admin-access' || pathname === '/clients-admin';
  const selectedKey = settingsActive
    ? `/settings${hash || '#general'}`
    : xrayActive
      ? `/xray${hash || '#basic'}`
      : (pathname === '' ? '/' : pathname);

  const openSubmenu = settingsActive ? '/settings' : xrayActive ? '/xray' : adminActive ? 'admin-access-parent' : null;
  const [openKeys, setOpenKeys] = useState<string[]>(() => (openSubmenu ? [openSubmenu] : []));
  useEffect(() => {
    if (openSubmenu) {
      setOpenKeys((keys) => (keys.includes(openSubmenu) ? keys : [...keys, openSubmenu]));
    }
  }, [openSubmenu]);

  const toMenuItems = useCallback((items: typeof tabs): MenuProps['items'] =>
    items.map((tab) => {
      const Icon = iconByName[tab.icon];
      if (tab.key === '/settings') {
        return { key: tab.key, icon: <Icon />, label: tab.title, children: settingsChildren };
      }
      if (tab.key === '/xray') {
        return { key: tab.key, icon: <Icon />, label: tab.title, children: xrayChildren };
      }
      if (tab.key === 'admin-access-parent') {
        return { key: tab.key, icon: <Icon />, label: tab.title, children: adminChildren };
      }
      if (tab.key === LOGOUT_KEY) {
        return { key: tab.key, icon: <Icon />, label: tab.title };
      }
      return { key: tab.key, icon: <Icon />, label: tab.title };
    }),
  [settingsChildren, xrayChildren, adminChildren, i18n.language]);

  const openLink = useCallback(async (key: string) => {
    if (key === LOGOUT_KEY) {
      const currentAdminRaw = localStorage.getItem('daltoon_current_admin');
      if (currentAdminRaw) {
        localStorage.removeItem('daltoon_current_admin');
        window.location.href = window.X_UI_BASE_PATH || '/';
        return;
      }
      await HttpUtil.post('/logout');
      window.location.href = window.X_UI_BASE_PATH || '/';
      return;
    }
    navigate(key);
  }, [navigate]);

  const onMenuClick = useCallback<NonNullable<MenuProps['onClick']>>(({ key }) => {
    openLink(String(key));
  }, [openLink]);

  const onSiderCollapse = useCallback((isCollapsed: boolean, type: 'clickTrigger' | 'responsive') => {
    if (type === 'clickTrigger') {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed));
      setCollapsed(isCollapsed);
    }
  }, []);

  const cycleTheme = useCallback((id: string) => {
    pauseAnimationsUntilLeave(id);
    if (!isDark) {
      toggleTheme();
      if (isUltra) toggleUltra();
    } else if (!isUltra) {
      toggleUltra();
    } else {
      toggleUltra();
      toggleTheme();
    }
  }, [isDark, isUltra, toggleTheme, toggleUltra]);

  return (
    <div className="ant-sidebar">
      <Layout.Sider
        theme={currentTheme}
        width={220}
        collapsible
        collapsed={collapsed}
        breakpoint="md"
        onCollapse={onSiderCollapse}
      >
        <div className={`sider-brand${collapsed ? ' sider-brand-collapsed' : ''}`}>
          <div className="brand-block">
            <span className="brand-text">{collapsed ? (brandName.length > 2 ? brandName.substring(0, 2).toUpperCase() : brandName) : brandName}</span>
          </div>
          {!collapsed && (
            <div className="brand-actions">
              <DocsButton ariaLabel={t('menu.docs') || 'Documentation'} />
              <DonateButton ariaLabel={t('menu.donate') || 'Donate'} />
              <ThemeCycleButton
                id="theme-cycle"
                isDark={isDark}
                isUltra={isUltra}
                onCycle={() => cycleTheme('theme-cycle')}
                ariaLabel={t('menu.theme')}
              />
            </div>
          )}
        </div>
        <Menu
          theme={currentTheme}
          mode="inline"
          selectedKeys={[selectedKey]}
          openKeys={collapsed ? undefined : openKeys}
          onOpenChange={(keys) => setOpenKeys(keys as string[])}
          className="sider-nav"
          items={toMenuItems(navItems)}
          onClick={onMenuClick}
        />
        <Menu
          theme={currentTheme}
          mode="inline"
          selectedKeys={[selectedKey]}
          className="sider-utility"
          items={toMenuItems(utilItems)}
          onClick={onMenuClick}
        />
        <div className="sider-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '4px' }}>
          {!collapsed && (
            <div className="developer-footer" style={{ padding: '8px 16px 4px', fontSize: '11px', opacity: 0.7 }}>
              <span>{getDeveloperByText(i18n.language || 'en-US')} </span>
              <a
                href="https://t.me/mDaltoon"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#1677ff', fontWeight: 'bold' }}
              >
                mDaltoon
              </a>
            </div>
          )}
          <VersionBadge version={panelVersion} collapsed={collapsed} />
        </div>
      </Layout.Sider>

      <Drawer
        placement="left"
        closable={false}
        open={drawerOpen}
        rootClassName={currentTheme}
        size="min(82vw, 320px)"
        styles={{
          wrapper: { padding: 0 },
          body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100%' },
          header: { display: 'none' },
        }}
        onClose={() => setDrawerOpen(false)}
      >
        <div className="drawer-header">
          <div className="brand-block">
            <span className="drawer-brand">{brandName}</span>
          </div>
          <div className="drawer-header-actions">
            <DocsButton ariaLabel={t('menu.docs') || 'Documentation'} />
            <DonateButton ariaLabel={t('menu.donate') || 'Donate'} />
            <ThemeCycleButton
              id="theme-cycle-drawer"
              isDark={isDark}
              isUltra={isUltra}
              onCycle={() => cycleTheme('theme-cycle-drawer')}
              ariaLabel={t('menu.theme')}
            />
            <button
              className="drawer-close"
              type="button"
              aria-label={t('close')}
              onClick={() => setDrawerOpen(false)}
            >
              <CloseOutlined />
            </button>
          </div>
        </div>
        <Menu
          theme={currentTheme}
          mode="inline"
          selectedKeys={[selectedKey]}
          openKeys={openKeys}
          onOpenChange={(keys) => setOpenKeys(keys as string[])}
          className="drawer-menu drawer-nav"
          items={toMenuItems(navItems)}
          onClick={(info) => { onMenuClick(info); setDrawerOpen(false); }}
        />
        <Menu
          theme={currentTheme}
          mode="inline"
          selectedKeys={[selectedKey]}
          className="drawer-menu drawer-utility"
          items={toMenuItems(utilItems)}
          onClick={(info) => { onMenuClick(info); setDrawerOpen(false); }}
        />
        <div className="drawer-footer">
          <div className="developer-footer" style={{ padding: '0 8px 8px', fontSize: '12px', opacity: 0.8 }}>
            <span>{getDeveloperByText(i18n.language || 'en-US')} </span>
            <a
              href="https://t.me/mDaltoon"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#1677ff', fontWeight: 'bold' }}
            >
              mDaltoon
            </a>
          </div>
          <VersionBadge version={panelVersion} />
        </div>
      </Drawer>

      {!drawerOpen && (
        <button
          className="drawer-handle"
          type="button"
          aria-label={t('menu.openMenu')}
          onClick={() => setDrawerOpen(true)}
        >
          <MenuOutlined />
        </button>
      )}
    </div>
  );
}
