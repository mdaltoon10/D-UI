import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Input, Modal } from 'antd';
import type { InputRef } from 'antd';
import {
  ApartmentOutlined,
  AppstoreOutlined,
  CodeOutlined,
  DatabaseOutlined,
  ExportOutlined,
  GlobalOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SettingOutlined,
  SwapOutlined,
  TagsOutlined,
  TeamOutlined,
} from '@ant-design/icons';

interface PaletteItem {
  key: string;
  path: string;
  titleKey: string;
  defaultTitle: string;
  icon: React.ReactNode;
  category: string;
}

const COMMAND_ITEMS: PaletteItem[] = [
  { key: 'dashboard', path: '/', titleKey: 'menu.dashboard', defaultTitle: 'Dashboard', icon: <AppstoreOutlined />, category: 'Navigation' },
  { key: 'inbounds', path: '/inbounds', titleKey: 'menu.inbounds', defaultTitle: 'Inbounds', icon: <ApartmentOutlined />, category: 'Navigation' },
  { key: 'clients', path: '/clients', titleKey: 'menu.clients', defaultTitle: 'Clients', icon: <TeamOutlined />, category: 'Navigation' },
  { key: 'groups', path: '/groups', titleKey: 'menu.groups', defaultTitle: 'Groups', icon: <TagsOutlined />, category: 'Navigation' },
  { key: 'nodes', path: '/nodes', titleKey: 'menu.nodes', defaultTitle: 'Nodes', icon: <DatabaseOutlined />, category: 'Navigation' },
  { key: 'hosts', path: '/hosts', titleKey: 'menu.hosts', defaultTitle: 'Hosts', icon: <GlobalOutlined />, category: 'Navigation' },
  { key: 'routing', path: '/routing', titleKey: 'menu.routing', defaultTitle: 'Routing Rules', icon: <SwapOutlined />, category: 'Xray & Network' },
  { key: 'outbound', path: '/outbound', titleKey: 'menu.outbounds', defaultTitle: 'Outbounds', icon: <ExportOutlined />, category: 'Xray & Network' },
  { key: 'xray', path: '/xray', titleKey: 'menu.xraySetting', defaultTitle: 'Xray Settings', icon: <SettingOutlined />, category: 'Xray & Network' },
  { key: 'settings', path: '/settings', titleKey: 'menu.setting', defaultTitle: 'Panel Settings', icon: <SettingOutlined />, category: 'System' },
  { key: 'api-docs', path: '/api-docs', titleKey: 'menu.apiDocs', defaultTitle: 'API Documentation', icon: <CodeOutlined />, category: 'System' },
  { key: 'authentication', path: '/authentication', titleKey: 'menu.adminsList', defaultTitle: 'Admin Access', icon: <SafetyCertificateOutlined />, category: 'System' },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef<InputRef>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return COMMAND_ITEMS;
    return COMMAND_ITEMS.filter((item) => {
      const translated = t(item.titleKey, item.defaultTitle).toLowerCase();
      const def = item.defaultTitle.toLowerCase();
      const path = item.path.toLowerCase();
      return translated.includes(q) || def.includes(q) || path.includes(q);
    });
  }, [search, t]);

  function handleSelect(path: string) {
    setOpen(false);
    if (location.pathname !== path) {
      navigate(path);
    }
  }

  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        handleSelect(filteredItems[selectedIndex].path);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <Modal
      open={open}
      footer={null}
      closable={false}
      onCancel={() => setOpen(false)}
      width={540}
      styles={{
        body: { padding: '12px' },
      }}
      destroyOnClose
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Input
          ref={inputRef}
          prefix={<SearchOutlined style={{ opacity: 0.5, marginRight: 6 }} />}
          placeholder={t('searchPlaceholder', 'Search pages, settings, or shortcuts... (Ctrl+K)')}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSelectedIndex(0);
          }}
          onKeyDown={handleInputKeyDown}
          allowClear
          size="large"
          style={{ borderRadius: '8px' }}
        />
        <div style={{ maxHeight: '360px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
          {filteredItems.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', opacity: 0.5 }}>
              {t('noResults', 'No matching results')}
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              const title = t(item.titleKey, item.defaultTitle);
              return (
                <button
                  type="button"
                  key={item.key}
                  onClick={() => handleSelect(item.path)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(22, 119, 255, 0.12)' : 'transparent',
                    color: isSelected ? '#1677ff' : 'inherit',
                    border: 'none',
                    textAlign: 'left',
                    width: '100%',
                    outline: 'none',
                    transition: 'background 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '16px' }}>{item.icon}</span>
                    <span style={{ fontWeight: isSelected ? 600 : 400 }}>{title}</span>
                  </div>
                  <span style={{ fontSize: '12px', opacity: 0.45 }}>{item.path}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}
