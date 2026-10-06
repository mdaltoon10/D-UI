import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Card,
  Button,
  Form,
  Input,
  Tabs,
  Switch,
  message,
  ConfigProvider,
  Layout,
  Typography,
  Alert,
} from 'antd';
import {
  UserOutlined,
  SafetyOutlined,
  ApiOutlined,
  LockOutlined,
  KeyOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { HttpUtil } from '@/utils';
import { useTheme } from '@/hooks/useTheme';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import AppSidebar from '@/layouts/AppSidebar';
import '@/pages/clients/ClientsPage.css'; // Inherit styling

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
  twoFactorEnable?: boolean;
}

export default function AuthenticationPage() {
  const { i18n } = useTranslation();
  const { antdThemeConfig } = useTheme();
  const { isMobile } = useMediaQuery();
  const [messageApi, messageContextHolder] = message.useMessage();

  const isFa = useMemo(() => i18n.language?.startsWith('fa'), [i18n.language]);

  const [loading, setLoading] = useState(false);
  const [adminData, setAdminData] = useState<ResellerAdmin | null>(null);

  // Form states
  const [currentUsername, setCurrentUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Password visibility
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Fetch admin details
  const fetchSelf = useCallback(async () => {
    setLoading(true);
    try {
      const res = await HttpUtil.get<ResellerAdmin>('/panel/api/admins/self');
      if (res?.success && res.obj) {
        setAdminData(res.obj);
        setCurrentUsername(res.obj.username || '');
        setNewUsername(res.obj.username || '');
      }
    } catch (err) {
      console.error('Failed to fetch admin details', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSelf();
  }, [fetchSelf]);

  const handleUpdateProfile = async () => {
    if (!currentPassword) {
      messageApi.error(isFa ? 'لطفا رمز عبور فعلی خود را وارد کنید' : 'Please enter your current password');
      return;
    }

    setLoading(true);
    try {
      const res = await HttpUtil.post<ResellerAdmin>('/panel/api/admins/selfUpdate', {
        oldPassword: currentPassword,
        newUsername: newUsername !== currentUsername ? newUsername : undefined,
        newPassword: newPassword || undefined,
      }, { headers: { 'Content-Type': 'application/json' } });

      if (res?.success) {
        messageApi.success(isFa ? 'اطلاعات با موفقیت بروزرسانی شد' : 'Profile updated successfully');
        setNewPassword('');
        setCurrentPassword('');
        fetchSelf();
      } else {
        messageApi.error(res?.msg || (isFa ? 'خطا در بروزرسانی اطلاعات' : 'Failed to update profile'));
      }
    } catch (err) {
      console.error(err);
      messageApi.error(isFa ? 'خطایی رخ داد' : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle2FA = async (checked: boolean) => {
    setLoading(true);
    try {
      const res = await HttpUtil.post<ResellerAdmin>('/panel/api/admins/selfUpdate', {
        oldPassword: '', // Don't require password for simple toggle
        twoFactorEnable: checked,
      }, { headers: { 'Content-Type': 'application/json' } });

      if (res?.success) {
        messageApi.success(
          checked
            ? isFa ? 'تایید دو مرحله‌ای فعال شد' : 'Two-factor authentication enabled'
            : isFa ? 'تایید دو مرحله‌ای غیرفعال شد' : 'Two-factor authentication disabled'
        );
        fetchSelf();
      } else {
        messageApi.error(isFa ? 'خطا در بروزرسانی تنظیمات' : 'Failed to update 2FA status');
      }
    } catch (err) {
      console.error(err);
      messageApi.error(isFa ? 'خطایی رخ داد' : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ConfigProvider theme={antdThemeConfig}>
      {messageContextHolder}
      <Layout style={{ minHeight: '100vh', direction: isFa ? 'rtl' : 'ltr' }}>
        <AppSidebar />
        <Layout className="site-layout">
          <Layout.Content style={{ padding: isMobile ? '12px' : '24px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
            
            <div style={{ marginBottom: 20 }}>
              <Typography.Title level={2} style={{ margin: 0, fontWeight: 700 }}>
                {isFa ? 'تنظیمات احراز هویت' : 'Authentication Settings'}
              </Typography.Title>
              <Typography.Text type="secondary">
                {isFa ? 'اطلاعات کاربری و تنظیمات امنیتی پنل خود را مدیریت کنید' : 'Manage your credentials and panel security settings'}
              </Typography.Text>
            </div>

            <Card style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              <Tabs
                defaultActiveKey="1"
                items={[
                  {
                    key: '1',
                    label: (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <UserOutlined />
                        {isFa ? 'پروفایل کاربری' : 'User Profile'}
                      </span>
                    ),
                    children: (
                      <div style={{ padding: '16px 0' }}>
                        <Form layout="vertical">
                          <Form.Item label={isFa ? 'نام کاربری فعلی' : 'Current Username'}>
                            <Input value={currentUsername} disabled prefix={<UserOutlined style={{ opacity: 0.5 }} />} style={{ borderRadius: 6 }} />
                          </Form.Item>

                          <Form.Item label={isFa ? 'رمز عبور فعلی (جهت تایید هویت)' : 'Current Password (to confirm identity)'} required>
                            <Input
                              type={showCurrentPassword ? 'text' : 'password'}
                              value={currentPassword}
                              onChange={(e) => setCurrentPassword(e.target.value)}
                              prefix={<LockOutlined style={{ opacity: 0.5 }} />}
                              suffix={
                                <Button
                                  type="text"
                                  size="small"
                                  icon={showCurrentPassword ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                />
                              }
                              placeholder="••••••••"
                              style={{ borderRadius: 6 }}
                            />
                          </Form.Item>

                          <Form.Item label={isFa ? 'نام کاربری جدید' : 'New Username'}>
                            <Input
                              value={newUsername}
                              onChange={(e) => setNewUsername(e.target.value)}
                              prefix={<UserOutlined style={{ opacity: 0.5 }} />}
                              placeholder={isFa ? 'نام کاربری جدید را وارد کنید' : 'Enter new username'}
                              style={{ borderRadius: 6 }}
                            />
                          </Form.Item>

                          <Form.Item label={isFa ? 'رمز عبور جدید' : 'New Password'}>
                            <Input
                              type={showNewPassword ? 'text' : 'password'}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              prefix={<KeyOutlined style={{ opacity: 0.5 }} />}
                              suffix={
                                <Button
                                  type="text"
                                  size="small"
                                  icon={showNewPassword ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                                  onClick={() => setShowNewPassword(!showNewPassword)}
                                />
                              }
                              placeholder={isFa ? 'خالی بگذارید تا رمز فعلی حفظ شود' : 'Leave empty to keep current password'}
                              style={{ borderRadius: 6 }}
                            />
                          </Form.Item>

                          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
                            <Button type="primary" loading={loading} onClick={handleUpdateProfile} style={{ borderRadius: 6, minWidth: 120 }}>
                              {isFa ? 'ذخیره تغییرات' : 'Confirm'}
                            </Button>
                          </div>
                        </Form>
                      </div>
                    ),
                  },
                  {
                    key: '2',
                    label: (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <SafetyOutlined />
                        {isFa ? 'تایید دو مرحله‌ای' : 'Two-Factor Auth'}
                      </span>
                    ),
                    children: (
                      <div style={{ padding: '24px 0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.02)', padding: '16px 20px', borderRadius: 8, border: '1px solid var(--ant-color-border-secondary)' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: 4 }}>
                              {isFa ? 'فعال‌سازی تایید دو مرحله‌ای (2FA)' : 'Enable Two-Factor Authentication'}
                            </div>
                            <div style={{ opacity: 0.6, fontSize: '0.85rem' }}>
                              {isFa
                                ? 'یک لایه امنیتی اضافی به حساب کاربری خود جهت افزایش امنیت ورود اضافه کنید.'
                                : 'Adds an additional layer of authentication to provide more security.'}
                            </div>
                          </div>
                          <Switch
                            checked={!!adminData?.twoFactorEnable}
                            onChange={handleToggle2FA}
                            loading={loading}
                          />
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: '3',
                    label: (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ApiOutlined />
                        {isFa ? 'توکن‌های API' : 'API Tokens'}
                      </span>
                    ),
                    children: (
                      <div style={{ padding: '24px 0' }}>
                        <Alert
                          message={isFa ? 'مدیریت توکن‌های API' : 'API Tokens Management'}
                          description={isFa
                            ? 'تنظیمات و دسترسی‌های توکن‌های API توسط مدیر اصلی سیستم مدیریت می‌شوند و ادمین‌های همکار مجاز به مدیریت آن‌ها نیستند.'
                            : 'API Token configurations are managed by the main system administrator. Reseller admins cannot directly create or manage API tokens.'}
                          type="info"
                          showIcon
                          style={{ borderRadius: 8 }}
                        />
                      </div>
                    ),
                  }
                ]}
              />
            </Card>

          </Layout.Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
