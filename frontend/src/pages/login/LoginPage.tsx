import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  ConfigProvider,
  Form,
  Input,
  Layout,
  Menu,
  Popover,
  Space,
  Spin,
  message,
} from 'antd';
import {
  KeyOutlined,
  LockOutlined,
  MoonFilled,
  MoonOutlined,
  SafetyOutlined,
  SunOutlined,
  TranslationOutlined,
  UserOutlined,
} from '@ant-design/icons';

import { HttpUtil, LanguageManager } from '@/utils';
import { antdRule } from '@/utils/zodForm';
import { setMessageInstance } from '@/utils/messageBus';
import { pauseAnimationsUntilLeave, useTheme } from '@/hooks/useTheme';
import { LoginFormSchema, TwoFactorCodeSchema, type LoginFormValues } from '@/schemas/login';
import './LoginPage.css';

const HEADLINE_INTERVAL_MS = 2000;

type LoginForm = LoginFormValues;

const basePath = window.X_UI_BASE_PATH || '';

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const { isDark, isUltra, toggleTheme, toggleUltra, antdThemeConfig } = useTheme();
  const [messageApi, messageContextHolder] = message.useMessage();

  const isFa = useMemo(() => i18n.language?.startsWith('fa'), [i18n.language]);

  const isResellerPortal = useMemo(() => {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('/portal/')) return true;
    const resellerWebPath = (window as unknown as { X_UI_RESELLER_WEB_PATH?: string }).X_UI_RESELLER_WEB_PATH;
    if (resellerWebPath && (window as unknown as { X_UI_IS_RESELLER?: boolean }).X_UI_IS_RESELLER) {
      if (path.includes(`/${resellerWebPath.toLowerCase()}`)) {
        return true;
      }
    }
    return false;
  }, []);

  useEffect(() => {
    if (!isResellerPortal) {
      localStorage.removeItem('daltoon_current_admin');
      sessionStorage.removeItem('daltoon_is_reseller');
      sessionStorage.removeItem('daltoon_reseller_webpath');
      localStorage.removeItem('daltoon_reseller_webpath');
    }
  }, [isResellerPortal]);

  useEffect(() => {
    setMessageInstance(messageApi);
  }, [messageApi]);

  const [fetched, setFetched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [twoFactorEnable, setTwoFactorEnable] = useState(false);
  const [headlineIndex, setHeadlineIndex] = useState(0);
  const [lang, setLang] = useState<string>(() => LanguageManager.getLanguage());

  const headlineWords = useMemo(
    () => [t('pages.login.hello'), t('pages.login.title')],
    [t],
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setHeadlineIndex((i) => (i + 1) % headlineWords.length);
    }, HEADLINE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [headlineWords.length]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const msg = await HttpUtil.post('getTwoFactorEnable');
        if (cancelled) return;
        if (msg.success) setTwoFactorEnable(!!msg.obj);
      } catch {
        // ignore error
      } finally {
        if (!cancelled) setFetched(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const resellerWebPath = useMemo(() => {
    if ((window as unknown as { X_UI_RESELLER_WEB_PATH?: string }).X_UI_RESELLER_WEB_PATH) {
      return (window as unknown as { X_UI_RESELLER_WEB_PATH?: string }).X_UI_RESELLER_WEB_PATH;
    }
    const path = window.location.pathname;
    const match = path.match(/\/portal\/([^/]+)/i);
    if (match && match[1]) {
      return match[1];
    }
    return undefined;
  }, []);

  const onSubmit = useCallback(async (values: LoginForm) => {
    setSubmitting(true);
    try {
      const payload: LoginForm = {
        ...values,
        isResellerPortal: isResellerPortal,
        portalWebPath: resellerWebPath,
      };
      const msg = await HttpUtil.post('login', payload);
      if (msg.success) {
        const obj = msg.obj as { isReseller?: boolean; webPath?: string; username?: string; remark?: string } | null;
        if (obj?.isReseller && obj?.webPath) {
          localStorage.setItem('daltoon_current_admin', JSON.stringify({
            username: obj.username,
            remark: obj.remark,
            webPath: obj.webPath
          }));
          const cleanBase = basePath.endsWith('/') ? basePath : basePath + '/';
          const webPathLower = obj.webPath.toLowerCase();
          const cleanBaseLower = cleanBase.toLowerCase();
          if (cleanBaseLower.endsWith('/' + webPathLower + '/')) {
            window.location.href = cleanBase + 'panel/';
          } else {
            window.location.href = cleanBase + obj.webPath + '/panel/';
          }
        } else {
          localStorage.removeItem('daltoon_current_admin');
          const cleanBase = basePath.endsWith('/') ? basePath : basePath + '/';
          window.location.href = cleanBase + 'panel/';
        }
      }
    } finally {
      setSubmitting(false);
    }
  }, [isResellerPortal, resellerWebPath]);

  const onLangChange = useCallback((next: string) => {
    setLang(next);
    LanguageManager.setLanguage(next);
  }, []);

  const cycleTheme = useCallback(() => {
    pauseAnimationsUntilLeave('login-theme-cycle');
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

  const pageClass = useMemo(() => {
    const classes = ['login-app'];
    if (isDark) classes.push('is-dark');
    if (isUltra) classes.push('is-ultra');
    return classes.join(' ');
  }, [isDark, isUltra]);

  const langMenuItems = useMemo(
    () => (LanguageManager.supportedLanguages as { value: string; name: string; icon: string }[]).map((l) => ({
      key: l.value,
      label: (
        <Space size={8}>
          <span aria-hidden="true">{l.icon}</span>
          <span>{l.name}</span>
        </Space>
      ),
    })),
    [],
  );

  const themeIcon = !isDark ? <SunOutlined /> : !isUltra ? <MoonOutlined /> : <MoonFilled />;

  return (
    <ConfigProvider theme={antdThemeConfig}>
      {messageContextHolder}
      <Layout className={pageClass}>
        <Layout.Content className="login-content">
          <div className="login-toolbar">
            <Button
              id="login-theme-cycle"
              shape="circle"
              size="large"
              className="toolbar-btn"
              aria-label={t('menu.theme')}
              title={t('menu.theme')}
              icon={themeIcon}
              onClick={cycleTheme}
            />
            <Popover
              rootClassName={isDark ? 'dark' : 'light'}
              placement="bottomRight"
              trigger="click"
              styles={{ content: { padding: 4 } }}
              content={
                <Menu
                  mode="vertical"
                  selectable
                  selectedKeys={[lang]}
                  items={langMenuItems}
                  onClick={({ key }) => onLangChange(key)}
                  style={{ border: 'none', minWidth: 160 }}
                />
              }
            >
              <Button
                shape="circle"
                size="large"
                className="toolbar-btn"
                aria-label={t('pages.settings.language')}
                icon={<TranslationOutlined />}
              />
            </Popover>
          </div>

          <div className="login-wrapper">
            {!fetched ? (
              <div className="login-loading">
                <Spin size="large" />
              </div>
            ) : (
              <div className="login-card">
                <div className="brand">
                  <span className="brand-name">D-UI</span>
                  {isResellerPortal ? (
                    <div className="portal-tag reseller">
                      <SafetyOutlined />
                      <span>{isFa ? 'پورتال نمایندگان' : 'Reseller Portal'}</span>
                    </div>
                  ) : (
                    <div className="portal-tag">
                      <UserOutlined />
                      <span>{isFa ? 'مالک پنل' : 'Panel Owner'}</span>
                    </div>
                  )}
                  <span className="brand-accent" aria-hidden="true" />
                </div>
                <h2 className="welcome">
                  <b key={headlineIndex}>{headlineWords[headlineIndex]}</b>
                </h2>

                <Form
                  layout="vertical"
                  className="login-form"
                  onFinish={onSubmit}
                  initialValues={{ username: '', password: '', twoFactorCode: '' }}
                >
                  <Form.Item
                    label={t('username')}
                    name="username"
                    rules={[antdRule(LoginFormSchema.shape.username, t)]}
                  >
                    <Input
                      prefix={<UserOutlined />}
                      autoComplete="username"
                      size="large"
                      placeholder={t('username')}
                      autoFocus
                    />
                  </Form.Item>

                  <Form.Item
                    label={t('password')}
                    name="password"
                    rules={[antdRule(LoginFormSchema.shape.password, t)]}
                  >
                    <Input.Password
                      prefix={<LockOutlined />}
                      autoComplete="current-password"
                      size="large"
                      placeholder={t('password')}
                    />
                  </Form.Item>

                  {twoFactorEnable && (
                    <Form.Item
                      label={t('twoFactorCode')}
                      name="twoFactorCode"
                      rules={[antdRule(TwoFactorCodeSchema, t)]}
                    >
                      <Input
                        prefix={<KeyOutlined />}
                        autoComplete="one-time-code"
                        size="large"
                        placeholder={t('twoFactorCode')}
                      />
                    </Form.Item>
                  )}

                  <Form.Item className="submit-row">
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={submitting}
                      size="large"
                      block
                    >
                      {t('login')}
                    </Button>
                  </Form.Item>
                </Form>
              </div>
            )}
          </div>
        </Layout.Content>
      </Layout>
    </ConfigProvider>
  );
}
