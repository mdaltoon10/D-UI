import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Input,
  Space,
  Switch,
  Tabs,
  message,
} from 'antd';
import { ApiOutlined, SafetyOutlined, UserOutlined } from '@ant-design/icons';
import { HttpUtil, RandomUtil } from '@/utils';
import type { AllSetting } from '@/models/setting';
import { SettingListItem } from '@/components/ui';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAdmin } from '@/pg-ui/hooks/use-admin';
import { isOwner } from '@/pg-ui/utils/rbac';
import { catTabLabel } from './catTabLabel';
import TwoFactorModal from './TwoFactorModal';
import ApiTokenTab from './ApiTokenTab';
import './SecurityTab.css';

interface ApiMsg<T = unknown> {
  success?: boolean;
  msg?: string;
  obj?: T;
}

interface SecurityTabProps {
  allSetting: AllSetting;
  updateSetting: (patch: Partial<AllSetting>) => void;
  saveSetting: (payload: Partial<AllSetting> & Record<string, unknown>) => Promise<unknown>;
}

type TfaType = 'set' | 'confirm';

interface TfaState {
  open: boolean;
  title: string;
  description: string;
  token: string;
  type: TfaType;
  onConfirm: (success: boolean, code?: string) => void;
}

const TFA_INITIAL: TfaState = {
  open: false,
  title: '',
  description: '',
  token: '',
  type: 'set',
  onConfirm: () => {},
};

export default function SecurityTab({ allSetting, updateSetting, saveSetting }: SecurityTabProps) {
  const { t } = useTranslation();
  const { isMobile } = useMediaQuery();
  const { admin: currentAdmin, isLoading: currentAdminLoading } = useAdmin();
  const [messageApi, messageContextHolder] = message.useMessage();

  const [tfa, setTfa] = useState<TfaState>(TFA_INITIAL);
  const [user, setUser] = useState({
    oldUsername: '',
    oldPassword: '',
    newUsername: '',
    newPassword: '',
  });
  const [updating, setUpdating] = useState(false);

  const openTfa = useCallback((opts: Omit<TfaState, 'open'>) => {
    setTfa({ ...opts, open: true });
  }, []);

  const onTfaConfirm = useCallback((success: boolean, code?: string) => {
    tfa.onConfirm(success, code);
  }, [tfa]);

  function updateUserField<K extends keyof typeof user>(key: K, value: string) {
    setUser((prev) => ({ ...prev, [key]: value }));
  }

  const sendUpdateUser = useCallback(async (twoFactorCode = '') => {
    setUpdating(true);
    try {
      const msg = await HttpUtil.post('/panel/api/setting/updateUser', { ...user, twoFactorCode }) as ApiMsg;
      if (msg?.success) {
        await HttpUtil.post('/logout');
        const basePath = window.X_UI_BASE_PATH || '/';
        window.location.replace(basePath);
      }
    } finally {
      setUpdating(false);
    }
  }, [user]);

  function onUpdateUserClick() {
    if (allSetting.twoFactorEnable) {
      openTfa({
        title: t('pages.settings.security.twoFactorModalChangeCredentialsTitle'),
        description: t('pages.settings.security.twoFactorModalChangeCredentialsStep'),
        token: '',
        type: 'confirm',
        onConfirm: (ok: boolean, code?: string) => {
          if (ok) sendUpdateUser(code || '');
        },
      });
    } else {
      sendUpdateUser();
    }
  }

  function toggleTwoFactor() {
    if (!allSetting.twoFactorEnable) {
      const newToken = RandomUtil.randomBase32String();
      openTfa({
        title: t('pages.settings.security.twoFactorModalSetTitle'),
        description: '',
        token: newToken,
        type: 'set',
        onConfirm: (ok: boolean) => {
          if (ok) {
            messageApi.success(t('pages.settings.security.twoFactorModalSetSuccess'));
            updateSetting({ twoFactorToken: newToken, twoFactorEnable: true });
          } else {
            updateSetting({ twoFactorEnable: false });
          }
        },
      });
    } else {
      openTfa({
        title: t('pages.settings.security.twoFactorModalDeleteTitle'),
        description: t('pages.settings.security.twoFactorModalRemoveStep'),
        token: '',
        type: 'confirm',
        onConfirm: async (ok: boolean, code?: string) => {
          if (!ok) return;
          const next = {
            ...allSetting,
            twoFactorEnable: false,
            twoFactorToken: '',
            twoFactorCode: code || '',
          };
          const msg = await saveSetting(next) as ApiMsg;
          if (msg?.success) {
            messageApi.success(t('pages.settings.security.twoFactorModalDeleteSuccess'));
            updateSetting({ twoFactorEnable: false, twoFactorToken: '', hasTwoFactorToken: false });
          }
        },
      });
    }
  }

  const canManageApiTokens = !currentAdminLoading && isOwner(currentAdmin);

  return (
    <>
      {messageContextHolder}
      <Tabs defaultActiveKey="1" items={[
        {
          key: '1',
          label: catTabLabel(<UserOutlined />, t('pages.settings.security.admin'), isMobile),
          children: (
            <>
              <SettingListItem paddings="small" title={t('pages.settings.oldUsername')}>
                <Input value={user.oldUsername} autoComplete="username"
                  onChange={(e) => updateUserField('oldUsername', e.target.value)} />
              </SettingListItem>
              <SettingListItem paddings="small" title={t('pages.settings.currentPassword')}>
                <Input.Password value={user.oldPassword} autoComplete="current-password"
                  onChange={(e) => updateUserField('oldPassword', e.target.value)} />
              </SettingListItem>
              <SettingListItem paddings="small" title={t('pages.settings.newUsername')}>
                <Input value={user.newUsername}
                  onChange={(e) => updateUserField('newUsername', e.target.value)} />
              </SettingListItem>
              <SettingListItem paddings="small" title={t('pages.settings.newPassword')}>
                <Input.Password value={user.newPassword} autoComplete="new-password"
                  onChange={(e) => updateUserField('newPassword', e.target.value)} />
              </SettingListItem>
              <div className="security-actions">
                <Space style={{ padding: '0 20px' }}>
                  <Button type="primary" loading={updating} onClick={onUpdateUserClick}>
                    {t('confirm')}
                  </Button>
                </Space>
              </div>
            </>
          ),
        },
        {
          key: '2',
          label: catTabLabel(<SafetyOutlined />, t('pages.settings.security.twoFactor'), isMobile),
          children: (
            <SettingListItem
              paddings="small"
              title={t('pages.settings.security.twoFactorEnable')}
              description={t('pages.settings.security.twoFactorEnableDesc')}
            >
              <Switch checked={allSetting.twoFactorEnable} onClick={toggleTwoFactor} />
            </SettingListItem>
          ),
        },
        ...(canManageApiTokens ? [{
          key: '3',
          label: catTabLabel(<ApiOutlined />, t('pages.nodes.apiToken'), isMobile),
          children: <ApiTokenTab />,
        }] : []),
      ]} />

      <TwoFactorModal
        open={tfa.open}
        title={tfa.title}
        description={tfa.description}
        token={tfa.token}
        type={tfa.type}
        onConfirm={onTfaConfirm}
        onOpenChange={(open) => setTfa((prev) => ({ ...prev, open }))}
      />
    </>
  );
}
