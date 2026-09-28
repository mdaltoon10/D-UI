import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Tabs,
} from 'antd';
import {
  ApartmentOutlined,
  BgColorsOutlined,
  CloudOutlined,
  LinkOutlined,
  MobileOutlined,
  NotificationOutlined,
  ThunderboltOutlined,
  WifiOutlined,
} from '@ant-design/icons';
import type { AllSetting } from '@/models/setting';
import { SettingListItem } from '@/components/ui';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { catTabLabel } from './catTabLabel';

interface HappTabProps {
  allSetting: AllSetting;
  updateSetting: (patch: Partial<AllSetting>) => void;
}

const COLOR_THEMES: Record<string, string> = {
  reset: '',
  violet: JSON.stringify({
    serverRowBackgroundColor: '#1e1427',
    primaryColor: '#8a2be2',
    accentColor: '#d8b4fe',
  }, null, 2),
  turquoise: JSON.stringify({
    serverRowBackgroundColor: '#0f2427',
    primaryColor: '#00ced1',
    accentColor: '#99f6e4',
  }, null, 2),
  emerald: JSON.stringify({
    serverRowBackgroundColor: '#0f2619',
    primaryColor: '#10b981',
    accentColor: '#a7f3d0',
  }, null, 2),
  midnight: JSON.stringify({
    serverRowBackgroundColor: '#0f172a',
    primaryColor: '#38bdf8',
    accentColor: '#93c5fd',
  }, null, 2),
};

export default function HappTab({ allSetting, updateSetting }: HappTabProps) {
  const { t } = useTranslation();
  const { isMobile } = useMediaQuery();
  const [activeSubTab, setActiveSubTab] = useState('routing');
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [genDirectDomains, setGenDirectDomains] = useState('');
  const [genDirectIPs, setGenDirectIPs] = useState('');
  const [genBlockedDomains, setGenBlockedDomains] = useState('');

  function applyPreset(preset: string) {
    let rules = '';
    if (preset === 'iran_bypass') {
      rules = 'happ://routing/onadd/domain:ir,geosite:ir,geoip:ir->direct;domain:googleapis.com,geosite:google->proxy';
    } else if (preset === 'adblock') {
      rules = 'happ://routing/onadd/geosite:category-ads-all->block;geoip:ir,geosite:ir->direct';
    } else if (preset === 'all_proxy') {
      rules = 'happ://routing/onadd/geoip:private->direct';
    }
    if (rules) {
      updateSetting({
        happRoutingPreset: preset,
        happRoutingRules: rules,
        subRoutingRules: rules,
      });
    }
  }

  function generateDeeplink() {
    const rules: string[] = [];
    if (genDirectDomains.trim()) {
      const doms = genDirectDomains.split('\n').map((s) => s.trim()).filter(Boolean).join(',');
      if (doms) rules.push(`domain:${doms}->direct`);
    }
    if (genDirectIPs.trim()) {
      const ips = genDirectIPs.split('\n').map((s) => s.trim()).filter(Boolean).join(',');
      if (ips) rules.push(`ip:${ips}->direct`);
    }
    if (genBlockedDomains.trim()) {
      const doms = genBlockedDomains.split('\n').map((s) => s.trim()).filter(Boolean).join(',');
      if (doms) rules.push(`domain:${doms}->block`);
    }
    const finalDeeplink = `happ://routing/onadd/${rules.join(';') || 'geoip:private->direct'}`;
    updateSetting({ happRoutingRules: finalDeeplink, subRoutingRules: finalDeeplink });
    setGeneratorOpen(false);
  }

  return (
    <div className="happ-settings">
      <SettingListItem
        paddings="small"
        title="Happ Header Auto-Detection"
        description="Automatically inject Happ routing and headers when client User-Agent indicates Happ."
        control={
          <Switch
            checked={!!allSetting.happHeaderAutoDetect}
            onChange={(checked) => updateSetting({ happHeaderAutoDetect: checked })}
          />
        }
      />

      <div style={{ marginTop: 12, marginBottom: 12 }}>
        <Tabs
          activeKey={activeSubTab}
          onChange={setActiveSubTab}
          items={[
            {
              key: 'routing',
              label: catTabLabel(<ApartmentOutlined />, t('pages.settings.happRouting', { defaultValue: 'Routing & Rules' }), isMobile),
            },
            {
              key: 'encrypted',
              label: catTabLabel(<LinkOutlined />, t('pages.settings.happEncrypted', { defaultValue: 'Encrypted Links' }), isMobile),
            },
            {
              key: 'banner',
              label: catTabLabel(<NotificationOutlined />, t('pages.settings.happBanner', { defaultValue: 'Banner & Alerts' }), isMobile),
            },
            {
              key: 'tun',
              label: catTabLabel(<WifiOutlined />, t('pages.settings.happTun', { defaultValue: 'TUN & Network' }), isMobile),
            },
            {
              key: 'theme',
              label: catTabLabel(<BgColorsOutlined />, t('pages.settings.happTheme', { defaultValue: 'Color Theme' }), isMobile),
            },
            {
              key: 'cloud',
              label: catTabLabel(<CloudOutlined />, t('pages.settings.happCloud', { defaultValue: 'Cloud & Provider' }), isMobile),
            },
            {
              key: 'mobile',
              label: catTabLabel(<MobileOutlined />, t('pages.settings.happMobile', { defaultValue: 'Android Per-App' }), isMobile),
            },
          ]}
        />
      </div>

      {activeSubTab === 'routing' && (
        <>
          <SettingListItem
            paddings="small"
            title={t('pages.settings.subEnableRouting', { defaultValue: 'Enable routing' })}
            description={t('pages.settings.subEnableRoutingDesc', { defaultValue: 'Global setting to enable routing in the VPN client. (Only for Happ)' })}
            control={
              <Switch
                checked={!!(allSetting.happRoutingEnable || allSetting.subEnableRouting)}
                onChange={(checked) => updateSetting({ happRoutingEnable: checked, subEnableRouting: checked })}
              />
            }
          />
          <SettingListItem
            paddings="small"
            title="Routing Presets"
            description="Pre-configured routing rule presets tailored for Happ clients."
            control={
              <Space>
                <Select
                  value={allSetting.happRoutingPreset || 'iran_bypass'}
                  style={{ width: 170 }}
                  onChange={(val) => {
                    updateSetting({ happRoutingPreset: val });
                    applyPreset(val);
                  }}
                  options={[
                    { value: 'iran_bypass', label: 'Iran Bypass' },
                    { value: 'adblock', label: 'Block Ads & Direct IR' },
                    { value: 'all_proxy', label: 'Proxy All Traffic' },
                  ]}
                />
                <Button type="primary" onClick={() => setPresetsOpen(true)}>
                  Routing Presets
                </Button>
              </Space>
            }
          />
          <SettingListItem
            paddings="small"
            title="Visual Rule Generator"
            description="Create custom routing deeplink from domain and IP lists."
            control={
              <Button icon={<ThunderboltOutlined />} onClick={() => setGeneratorOpen(true)}>
                Visual Rule Generator
              </Button>
            }
          />
          <SettingListItem
            paddings="small"
            title={t('pages.settings.subRoutingRules', { defaultValue: 'Routing rules' })}
            description={t('pages.settings.subRoutingRulesDesc', { defaultValue: 'Paste a ready happ:// deeplink or one permanent HTTPS URL returning a deeplink or JSON. The panel refreshes remote rules in the background and keeps the last valid value, so subscription requests never wait for the source. (Happ only)' })}
          >
            <Input.TextArea
              rows={3}
              value={allSetting.happRoutingRules || allSetting.subRoutingRules || ''}
              placeholder="happ://routing/onadd/... or https://...DEFAULT.DEEPLINK"
              onChange={(e) => updateSetting({ happRoutingRules: e.target.value, subRoutingRules: e.target.value })}
            />
          </SettingListItem>
          <SettingListItem
            paddings="small"
            title="No-Limit Mode"
            description="Raise the xray-core RAM limit in Happ for better stability and performance (beta)."
            control={
              <Switch
                checked={!!allSetting.happNoLimitMode}
                onChange={(checked) => updateSetting({ happNoLimitMode: checked })}
              />
            }
          />
          <SettingListItem
            paddings="small"
            title={t('pages.settings.subHideSettings', { defaultValue: 'Hide server settings' })}
            description={t('pages.settings.subHideSettingsDesc', { defaultValue: 'Hide the ability to view and edit server configurations in the VPN client. (Only for Happ)' })}
            control={
              <Switch
                checked={!!(allSetting.happHideSettings || allSetting.subHideSettings)}
                onChange={(checked) => updateSetting({ happHideSettings: checked, subHideSettings: checked })}
              />
            }
          />
        </>
      )}

      {activeSubTab === 'encrypted' && (
        <SettingListItem
          paddings="small"
          title="Encrypted subscription links"
          description="Allow encrypted Happ links to be generated in the client QR code window. Subscription URLs are processed locally."
          control={
            <Switch
              checked={!!allSetting.happEncryptEnable}
              onChange={(checked) => updateSetting({ happEncryptEnable: checked })}
            />
          }
        />
      )}

      {activeSubTab === 'banner' && (
        <>
          <SettingListItem
            paddings="small"
            title="Banner Announcement Text"
            description="Custom announcement banner displayed at the top of the Happ client (max 200 characters)."
          >
            <Input
              value={allSetting.happBannerText || ''}
              placeholder="Welcome to our high-speed network!"
              maxLength={200}
              onChange={(e) => updateSetting({ happBannerText: e.target.value })}
            />
          </SettingListItem>
          <SettingListItem
            paddings="small"
            title="Banner Accent Color"
            description="Color theme style for the announcement banner."
            control={
              <Select
                value={allSetting.happBannerColor || 'blue'}
                style={{ width: 220 }}
                onChange={(val) => updateSetting({ happBannerColor: val })}
                options={[
                  { value: 'blue', label: 'Blue (Standard / Default)' },
                  { value: 'green', label: 'Green' },
                  { value: 'red', label: 'Red' },
                  { value: 'violet', label: 'Violet' },
                  { value: 'turquoise', label: 'Turquoise' },
                  { value: 'orange', label: 'Orange' },
                ]}
              />
            }
          />
          <SettingListItem
            paddings="small"
            title="Banner Button Text"
            description="Button label displayed inside the announcement banner (max 25 characters)."
          >
            <Input
              value={allSetting.happBannerBtnText || ''}
              placeholder="Support Channel"
              maxLength={25}
              onChange={(e) => updateSetting({ happBannerBtnText: e.target.value })}
            />
          </SettingListItem>
          <SettingListItem
            paddings="small"
            title="Banner Button Link"
            description="Target URL opened when the user clicks the banner action button."
          >
            <Input
              value={allSetting.happBannerBtnLink || ''}
              placeholder="https://t.me/your_channel"
              onChange={(e) => updateSetting({ happBannerBtnLink: e.target.value })}
            />
          </SettingListItem>
          <SettingListItem
            paddings="small"
            title="Expired Subscription Banner"
            description="Show an expired subscription banner in Happ when the user's traffic or validity has ended."
            control={
              <Switch
                checked={!!allSetting.happExpiredBanner}
                onChange={(checked) => updateSetting({ happExpiredBanner: checked })}
              />
            }
          />
          <SettingListItem
            paddings="small"
            title="Renewal Link"
            description="Target URL opened when the user clicks the renewal button on an expired subscription."
          >
            <Input
              value={allSetting.happRenewalLink || ''}
              placeholder="https://example.com/renew"
              onChange={(e) => updateSetting({ happRenewalLink: e.target.value })}
            />
          </SettingListItem>
          <SettingListItem
            paddings="small"
            title="Expiration Notifications"
            description="Instruct Happ to remind the user 3 days before their subscription expires."
            control={
              <Switch
                checked={!!allSetting.happExpireNotify}
                onChange={(checked) => updateSetting({ happExpireNotify: checked })}
              />
            }
          />
        </>
      )}

      {activeSubTab === 'tun' && (
        <>
          <SettingListItem
            paddings="small"
            title="TUN Mode"
            description="Network stack used by TUN on desktop: system (OS stack) or gVisor (userspace stack)."
            control={
              <Select
                value={allSetting.happTunMode || 'default'}
                style={{ width: 220 }}
                onChange={(val) => updateSetting({ happTunMode: val })}
                options={[
                  { value: 'default', label: 'Default' },
                  { value: 'system', label: 'System (OS stack)' },
                  { value: 'gvisor', label: 'gVisor (userspace stack)' },
                ]}
              />
            }
          />
          <SettingListItem
            paddings="small"
            title="TUN Engine"
            description="Core used for the TUN connection on desktop: sing-box, tun2proxy, default (Happ TUN), or Xray."
            control={
              <Select
                value={allSetting.happTunEngine || 'default'}
                style={{ width: 220 }}
                onChange={(val) => updateSetting({ happTunEngine: val })}
                options={[
                  { value: 'default', label: 'Default (Happ TUN)' },
                  { value: 'sing-box', label: 'sing-box' },
                  { value: 'tun2proxy', label: 'tun2proxy' },
                  { value: 'xray', label: 'Xray' },
                ]}
              />
            }
          />
          <SettingListItem
            paddings="small"
            title="Exclude CIDR Routes"
            description="Comma-separated IP CIDRs (e.g. 192.168.0.0/16, 10.0.0.0/8) to bypass the VPN tunnel."
          >
            <Input
              value={allSetting.happExcludeCidr || ''}
              placeholder="192.168.0.0/16, 10.0.0.0/8"
              onChange={(e) => updateSetting({ happExcludeCidr: e.target.value })}
            />
          </SettingListItem>
          <SettingListItem
            paddings="small"
            title="Exclude Apple APNs"
            description="Bypass Apple Push Notification services to maintain reliable background notifications on iOS."
            control={
              <Switch
                checked={!!allSetting.happExcludeApns}
                onChange={(checked) => updateSetting({ happExcludeApns: checked })}
              />
            }
          />
          <SettingListItem
            paddings="small"
            title="Latency Ping Method"
            description="How Happ measures node latency: via proxy (GET or HEAD), TCP, or ICMP."
            control={
              <Select
                value={allSetting.happPingMethod || 'proxy_get'}
                style={{ width: 220 }}
                onChange={(val) => updateSetting({ happPingMethod: val })}
                options={[
                  { value: 'proxy_get', label: 'via Proxy (GET Latency)' },
                  { value: 'proxy_head', label: 'via Proxy (HEAD Latency)' },
                  { value: 'tcp', label: 'TCP Ping' },
                  { value: 'icmp', label: 'ICMP Ping' },
                ]}
              />
            }
          />
          <SettingListItem
            paddings="small"
            title="Auto-Connect on Launch"
            description="Instruct Happ to automatically connect to VPN when the application starts."
            control={
              <Switch
                checked={!!allSetting.happAutoConnect}
                onChange={(checked) => updateSetting({ happAutoConnect: checked })}
              />
            }
          />
          <SettingListItem
            paddings="small"
            title="Auto-Connect Target"
            description="Server chosen for auto-connect: lowest delay, last used, or a random node."
            control={
              <Select
                value={allSetting.happAutoConnectTarget || 'lowest_delay'}
                style={{ width: 240 }}
                onChange={(val) => updateSetting({ happAutoConnectTarget: val })}
                options={[
                  { value: 'lowest_delay', label: 'Lowest Delay (Fastest Node)' },
                  { value: 'last_used', label: 'Last Used' },
                  { value: 'random', label: 'Random Node' },
                ]}
              />
            }
          />
        </>
      )}

      {activeSubTab === 'theme' && (
        <SettingListItem
          paddings="small"
          title="Client Color Theme"
          description="Custom iOS color theme as a JSON string, or reset colors to restore the default colors."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Input.TextArea
              rows={4}
              value={allSetting.happColorTheme || ''}
              placeholder='{"serverRowBackgroundColor": "#210..."}'
              onChange={(e) => updateSetting({ happColorTheme: e.target.value })}
            />
            <Space wrap>
              <Button onClick={() => updateSetting({ happColorTheme: COLOR_THEMES.reset })}>Reset</Button>
              <Button onClick={() => updateSetting({ happColorTheme: COLOR_THEMES.violet })}>Violet</Button>
              <Button onClick={() => updateSetting({ happColorTheme: COLOR_THEMES.turquoise })}>Turquoise</Button>
              <Button onClick={() => updateSetting({ happColorTheme: COLOR_THEMES.emerald })}>Emerald</Button>
              <Button onClick={() => updateSetting({ happColorTheme: COLOR_THEMES.midnight })}>Midnight</Button>
            </Space>
          </div>
        </SettingListItem>
      )}

      {activeSubTab === 'cloud' && (
        <>
          <SettingListItem
            paddings="small"
            title="Provider ID"
            description="Unique provider identifier for Happ client management, remote configuration binding, and migration."
          >
            <Input
              value={allSetting.happProviderId || ''}
              placeholder="my-happ-provider"
              onChange={(e) => updateSetting({ happProviderId: e.target.value })}
            />
          </SettingListItem>
          <SettingListItem
            paddings="small"
            title="New Subscription URL"
            description="Target URL for automatic client migration. When set, Happ clients will migrate to this subscription link."
          >
            <Input
              value={allSetting.happNewSubUrl || ''}
              placeholder="https://new-domain.com/sub/..."
              onChange={(e) => updateSetting({ happNewSubUrl: e.target.value })}
            />
          </SettingListItem>
          <SettingListItem
            paddings="small"
            title="Fallback Subscription URL"
            description="Backup subscription address used by Happ if the primary subscription URL becomes unreachable."
          >
            <Input
              value={allSetting.happFallbackSubUrl || ''}
              placeholder="https://backup-domain.com/sub/..."
              onChange={(e) => updateSetting({ happFallbackSubUrl: e.target.value })}
            />
          </SettingListItem>
          <SettingListItem
            paddings="small"
            title="Enforce Hardware ID (HWID)"
            description="Prevent users from turning off HWID sending in the Happ settings."
            control={
              <Switch
                checked={!!allSetting.happEnforceHwid}
                onChange={(checked) => updateSetting({ happEnforceHwid: checked })}
              />
            }
          />
        </>
      )}

      {activeSubTab === 'mobile' && (
        <>
          <SettingListItem
            paddings="small"
            title="Android Per-App Proxy Mode"
            description="Control Android application routing: off, on (proxy only listed apps), or bypass (exclude listed apps)."
            control={
              <Select
                value={allSetting.happAndroidPerApp || 'off'}
                style={{ width: 240 }}
                onChange={(val) => updateSetting({ happAndroidPerApp: val })}
                options={[
                  { value: 'off', label: 'Off' },
                  { value: 'proxy', label: 'Proxy only listed apps' },
                  { value: 'bypass', label: 'Bypass (exclude listed apps)' },
                ]}
              />
            }
          />
          <SettingListItem
            paddings="small"
            title="Android Package Names"
            description="Comma-separated package names of Android applications to include or exclude (e.g. org.telegram.messenger)."
          >
            <Input.TextArea
              rows={3}
              value={allSetting.happAndroidPackages || ''}
              placeholder="org.telegram.messenger, com.google.android.youtube"
              onChange={(e) => updateSetting({ happAndroidPackages: e.target.value })}
            />
          </SettingListItem>
        </>
      )}

      <Modal
        open={generatorOpen}
        title="Visual Rule Generator"
        onCancel={() => setGeneratorOpen(false)}
        onOk={generateDeeplink}
        okText="Insert Deeplink"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <b>Direct Domains (one per line):</b>
            <Input.TextArea
              rows={3}
              placeholder="ir&#10;*.ir&#10;bank.com"
              value={genDirectDomains}
              onChange={(e) => setGenDirectDomains(e.target.value)}
            />
          </div>
          <div>
            <b>Direct IPs / CIDRs (one per line):</b>
            <Input.TextArea
              rows={2}
              placeholder="10.0.0.0/8&#10;192.168.0.0/16"
              value={genDirectIPs}
              onChange={(e) => setGenDirectIPs(e.target.value)}
            />
          </div>
          <div>
            <b>Blocked Domains (one per line):</b>
            <Input.TextArea
              rows={2}
              placeholder="adservice.google.com&#10;analytics.twitter.com"
              value={genBlockedDomains}
              onChange={(e) => setGenBlockedDomains(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={presetsOpen}
        title="Happ Routing Presets"
        onCancel={() => setPresetsOpen(false)}
        footer={null}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Button
            block
            type="primary"
            onClick={() => {
              applyPreset('iran_bypass');
              setPresetsOpen(false);
            }}
          >
            Iran Bypass (Direct .ir, geoip:ir, Google Proxy)
          </Button>
          <Button
            block
            onClick={() => {
              applyPreset('adblock');
              setPresetsOpen(false);
            }}
          >
            Block Ads + Direct Iran
          </Button>
          <Button
            block
            onClick={() => {
              applyPreset('all_proxy');
              setPresetsOpen(false);
            }}
          >
            Proxy Everything (Private IP Direct)
          </Button>
        </div>
      </Modal>
    </div>
  );
}
