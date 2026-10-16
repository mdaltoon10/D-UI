import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, InputNumber, Select, Switch, Tabs, message } from 'antd';
import { BellOutlined, SettingOutlined } from '@ant-design/icons';
import { LanguageManager, HttpUtil } from '@/utils';
import type { AllSetting } from '@/models/setting';
import { SettingListItem } from '@/components/ui';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { catTabLabel } from './catTabLabel';

interface DiscordTabProps {
  allSetting: AllSetting;
  updateSetting: (patch: Partial<AllSetting>) => void;
}

export default function DiscordTab({ allSetting, updateSetting }: DiscordTabProps) {
  const { t } = useTranslation();
  const { isMobile } = useMediaQuery();
  const [testing, setTesting] = useState(false);

  const langOptions = useMemo(
    () => LanguageManager.supportedLanguages.map((l) => ({
      value: l.value,
      label: (
        <>
          <span role="img" aria-label={l.name}>{l.icon}</span>
          &nbsp;&nbsp;<span>{l.name}</span>
        </>
      ),
    })),
    [],
  );

  async function testDiscord() {
    setTesting(true);
    try {
      const msg = await HttpUtil.post('/panel/api/setting/testDiscord', {
        discordToken: allSetting.discordToken,
        discordChannelId: allSetting.discordChannelId,
      }) as { success?: boolean; msg?: string };
      if (msg?.success) {
        message.success(t('success', { defaultValue: 'Success' }));
      } else {
        message.error(msg?.msg || t('failed', { defaultValue: 'Failed' }));
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      message.error(errorMsg);
    } finally {
      setTesting(false);
    }
  }

  return (
    <Tabs defaultActiveKey="1" items={[
      {
        key: '1',
        label: catTabLabel(<SettingOutlined />, t('pages.settings.telegramBotSettings.tabGeneral', { defaultValue: 'General' }), isMobile),
        children: (
          <>
            <SettingListItem
              paddings="small"
              title={t('pages.settings.discordEnable', { defaultValue: 'Enable Discord Bot' })}
              description={t('pages.settings.discordEnableDesc', { defaultValue: 'Enable Discord bot notifications and commands' })}
            >
              <Switch
                checked={!!allSetting.discordEnable}
                onChange={(v) => updateSetting({ discordEnable: v })}
              />
            </SettingListItem>

            <SettingListItem
              paddings="small"
              title={t('pages.settings.discordToken', { defaultValue: 'Bot Token' })}
              description={t('pages.settings.discordTokenDesc', { defaultValue: 'Discord Bot Authentication Token' })}
            >
              <Input.Password
                value={allSetting.discordToken || ''}
                placeholder="MTA..."
                onChange={(e) => updateSetting({ discordToken: e.target.value })}
              />
            </SettingListItem>

            <SettingListItem
              paddings="small"
              title={t('pages.settings.discordChannelId', { defaultValue: 'Channel ID' })}
              description={t('pages.settings.discordChannelIdDesc', { defaultValue: 'Target Discord Channel ID for notifications' })}
            >
              <Input
                value={allSetting.discordChannelId || ''}
                placeholder="123456789012345678"
                onChange={(e) => updateSetting({ discordChannelId: e.target.value })}
              />
            </SettingListItem>

            <SettingListItem
              paddings="small"
              title={t('pages.settings.discordAdminUsers', { defaultValue: 'Admin User IDs' })}
              description={t('pages.settings.discordAdminUsersDesc', { defaultValue: 'Comma-separated Discord User IDs allowed to execute admin bot commands' })}
            >
              <Input
                value={allSetting.discordAdminUsers || ''}
                placeholder="123456789, 987654321"
                onChange={(e) => updateSetting({ discordAdminUsers: e.target.value })}
              />
            </SettingListItem>

            <SettingListItem
              paddings="small"
              title={t('pages.settings.discordLang', { defaultValue: 'Language' })}
              description={t('pages.settings.discordLangDesc', { defaultValue: 'Language used by the Discord bot' })}
            >
              <Select
                value={allSetting.discordLang || 'en-US'}
                style={{ width: 220 }}
                options={langOptions}
                onChange={(val) => updateSetting({ discordLang: val })}
              />
            </SettingListItem>

            <SettingListItem
              paddings="small"
              title={t('pages.settings.discordBackup', { defaultValue: 'Auto Backup' })}
              description={t('pages.settings.discordBackupDesc', { defaultValue: 'Send database backups to Discord channel' })}
            >
              <Switch
                checked={!!allSetting.discordBackup}
                onChange={(v) => updateSetting({ discordBackup: v })}
              />
            </SettingListItem>

            <SettingListItem
              paddings="small"
              title={t('pages.settings.testDiscord', { defaultValue: 'Test Connection' })}
              description={t('pages.settings.testDiscordDesc', { defaultValue: 'Send a test message to the configured Discord channel' })}
            >
              <Button type="primary" loading={testing} onClick={testDiscord}>
                {t('pages.settings.testBot', { defaultValue: 'Test Bot' })}
              </Button>
            </SettingListItem>
          </>
        ),
      },
      {
        key: '2',
        label: catTabLabel(<BellOutlined />, t('pages.settings.telegramBotSettings.tabNotify', { defaultValue: 'Notifications' }), isMobile),
        children: (
          <>
            <SettingListItem
              paddings="small"
              title={t('pages.settings.discordCpu', { defaultValue: 'CPU Alert Threshold' })}
              description={t('pages.settings.discordCpuDesc', { defaultValue: 'Trigger alert when CPU exceeds this percent (0-100)' })}
            >
              <InputNumber
                value={allSetting.discordCpu ?? 80}
                min={0}
                max={100}
                addonAfter="%"
                style={{ width: 140 }}
                onChange={(v) => updateSetting({ discordCpu: Number(v) || 80 })}
              />
            </SettingListItem>

            <SettingListItem
              paddings="small"
              title={t('pages.settings.discordMemory', { defaultValue: 'Memory Alert Threshold' })}
              description={t('pages.settings.discordMemoryDesc', { defaultValue: 'Trigger alert when RAM exceeds this percent (0-100)' })}
            >
              <InputNumber
                value={allSetting.discordMemory ?? 80}
                min={0}
                max={100}
                addonAfter="%"
                style={{ width: 140 }}
                onChange={(v) => updateSetting({ discordMemory: Number(v) || 80 })}
              />
            </SettingListItem>
          </>
        ),
      },
    ]} />
  );
}
