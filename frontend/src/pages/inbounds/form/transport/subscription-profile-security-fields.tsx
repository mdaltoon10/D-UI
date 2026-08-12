import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Collapse,
  Descriptions,
  Divider,
  Form,
  Input,
  InputNumber,
  Radio,
  Select,
  Space,
  Switch,
  Tooltip,
  type FormInstance,
} from 'antd';
import {
  CloudDownloadOutlined,
  FileProtectOutlined,
  MinusOutlined,
  PlusOutlined,
  RadarChartOutlined,
  ReloadOutlined,
  SearchOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';

import RealityTargetScannerModal from '@/pages/inbounds/form/security/RealityTargetScannerModal';
import {
  ALPN_OPTION,
  DOMAIN_STRATEGY_OPTION,
  TLS_CIPHER_OPTION,
  TLS_VERSION_OPTION,
  USAGE_OPTION,
  UTLS_FINGERPRINT,
} from '@/schemas/primitives';
import { SockoptStreamSettingsSchema } from '@/schemas/protocols/stream/sockopt';
import { validateRealityTarget } from '@/lib/xray/stream-wire-normalize';
import {
  createProfileRuntimeRealityDefaults,
  createProfileRuntimeTlsDefaults,
  createProfileTlsCertificateDraft,
  isClientVersionRangeValid,
  isClientVersionValid,
  isRealityShortIdValid,
  isTlsVersionRangeValid,
  pemLinesToText,
  pemTextToLines,
  resolvePreferredRealityValue,
} from '@/lib/xray/forms/security';
import type { SubscriptionProfileSecurityActions } from './use-subscription-profile-security-actions';

interface ProfileFieldProps {
  label: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
}

function ProfileSecurityField({ label, children, hint }: ProfileFieldProps) {
  return (
    <div className="ext-proxy-security-row">
      <span className="ext-proxy-flabel ext-proxy-security-label">
        <span>{label}</span>
        {hint && (
          <Tooltip title={hint} placement="top">
            <QuestionCircleOutlined
              className="ext-proxy-security-help"
              tabIndex={0}
              aria-label={typeof hint === 'string' ? hint : undefined}
            />
          </Tooltip>
        )}
      </span>
      <div className="ext-proxy-security-control">{children}</div>
    </div>
  );
}

interface ProfileSecurityBlockProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

function ProfileSecurityBlock({
  title,
  description,
  action,
  children,
  className = '',
}: ProfileSecurityBlockProps) {
  return (
    <section className={`ext-proxy-security-block ${className}`.trim()}>
      <header className="ext-proxy-security-block__head">
        <div className="ext-proxy-security-block__copy">
          <strong className="ext-proxy-security-block__title">{title}</strong>
          {description && (
            <span className="ext-proxy-security-block__description">
              {description}
            </span>
          )}
        </div>
        {action && (
          <div className="ext-proxy-security-block__action">{action}</div>
        )}
      </header>
      <div className="ext-proxy-security-block__body">{children}</div>
    </section>
  );
}

export function ProfileSecurityStatus({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning';
}) {
  return (
    <div
      className={`ext-proxy-security-status ext-proxy-security-status--${tone}`}
      role="status"
    >
      <span className="ext-proxy-security-status__dot" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

interface ProfileClientSecurityFieldsProps {
  fieldName: number;
  absoluteBase: (string | number)[];
  security: string;
  form: FormInstance;
  actions: SubscriptionProfileSecurityActions;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function sameStringList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length
    && left.every((value, index) => value === right[index]);
}

export function ProfileClientSecurityFields({
  fieldName,
  absoluteBase,
  security,
  form,
  actions,
}: ProfileClientSecurityFieldsProps) {
  const { t } = useTranslation();
  const overrideSniFromAddress = Form.useWatch(
    [...absoluteBase, 'overrideSniFromAddress'],
    form,
  ) === true;
  const keepSniBlank = Form.useWatch(
    [...absoluteBase, 'keepSniBlank'],
    form,
  ) === true;
  const realityServerNames = (Form.useWatch(
    [...absoluteBase, 'realitySettings', 'serverNames'],
    form,
  ) ?? []) as string[];
  const realityShortIds = (Form.useWatch(
    [...absoluteBase, 'realitySettings', 'shortIds'],
    form,
  ) ?? []) as string[];
  const destination = stringValue(Form.useWatch(
    [...absoluteBase, 'dest'],
    { form, preserve: true },
  ));
  const clientTlsServerName = stringValue(Form.useWatch(
    [...absoluteBase, 'tlsSettings', 'serverName'],
    form,
  ));
  const runtimeTlsSettings = Form.useWatch(
    [...absoluteBase, 'runtime', 'tlsSettings'],
    { form, preserve: true },
  );
  const runtimeTlsServerName = stringValue(Form.useWatch(
    [...absoluteBase, 'runtime', 'tlsSettings', 'serverName'],
    { form, preserve: true },
  ));
  const runtimeRealitySettings = Form.useWatch(
    [...absoluteBase, 'runtime', 'realitySettings'],
    { form, preserve: true },
  );
  const runtimeRealityServerNames = Form.useWatch(
    [...absoluteBase, 'runtime', 'realitySettings', 'serverNames'],
    { form, preserve: true },
  );
  const preferredRealityServerName = stringValue(Form.useWatch(
    [...absoluteBase, 'realitySettings', 'settings', 'serverName'],
    form,
  ));
  const tlsSniHydrated = useRef(false);
  const realitySniHydrated = useRef(false);

  useEffect(() => {
    if (security !== 'tls' || runtimeTlsSettings == null) return;

    const clientPath = [...absoluteBase, 'tlsSettings', 'serverName'];
    const runtimePath = [
      ...absoluteBase,
      'runtime',
      'tlsSettings',
      'serverName',
    ];

    if (!tlsSniHydrated.current) {
      tlsSniHydrated.current = true;
      if (
        !overrideSniFromAddress
        && !keepSniBlank
        && clientTlsServerName.length === 0
        && runtimeTlsServerName.length > 0
      ) {
        form.setFieldValue(clientPath, runtimeTlsServerName);
        return;
      }
    }

    const effectiveClientSni = keepSniBlank
      ? ''
      : overrideSniFromAddress
        ? destination.trim()
        : clientTlsServerName;

    if (runtimeTlsServerName !== effectiveClientSni) {
      form.setFieldValue(runtimePath, effectiveClientSni);
    }
  }, [
    absoluteBase,
    clientTlsServerName,
    destination,
    form,
    keepSniBlank,
    overrideSniFromAddress,
    runtimeTlsServerName,
    runtimeTlsSettings,
    security,
  ]);

  useEffect(() => {
    if (security !== 'reality') return;

    const clientNames = stringList(realityServerNames);
    const serverNames = stringList(runtimeRealityServerNames);
    const clientPath = [...absoluteBase, 'realitySettings', 'serverNames'];
    const runtimePath = [
      ...absoluteBase,
      'runtime',
      'realitySettings',
      'serverNames',
    ];
    const preferredPath = [
      ...absoluteBase,
      'realitySettings',
      'settings',
      'serverName',
    ];

    if (!realitySniHydrated.current && runtimeRealitySettings != null) {
      realitySniHydrated.current = true;
      if (clientNames.length === 0 && serverNames.length > 0) {
        form.setFieldValue(clientPath, serverNames);
        form.setFieldValue(
          preferredPath,
          resolvePreferredRealityValue(serverNames, preferredRealityServerName),
        );
        return;
      }
    }

    const resolvedPreferred = resolvePreferredRealityValue(
      clientNames,
      preferredRealityServerName,
    );
    if (resolvedPreferred !== preferredRealityServerName) {
      form.setFieldValue(preferredPath, resolvedPreferred);
    }

    if (
      runtimeRealitySettings != null
      && !sameStringList(serverNames, clientNames)
    ) {
      form.setFieldValue(runtimePath, clientNames);
    }
  }, [
    absoluteBase,
    form,
    preferredRealityServerName,
    realityServerNames,
    runtimeRealityServerNames,
    runtimeRealitySettings,
    security,
  ]);

  if (security === 'none') {
    return (
      <ProfileSecurityStatus>
        {t('pages.inbounds.form.profileSecurityDisabled')}
      </ProfileSecurityStatus>
    );
  }

  if (security === 'tls') {
    return (
      <ProfileSecurityBlock
        className="ext-proxy-security-block--client"
        title={t('pages.inbounds.form.profileClientTlsSettings', {
          defaultValue: 'Client TLS settings',
        })}
        description={t('pages.inbounds.form.profileClientTlsSettingsHint', {
          defaultValue: 'Controls how subscription clients connect to this profile.',
        })}
      >
        <div className="ext-proxy-security-form ext-proxy-security-form--client">
          <ProfileSecurityField label="SNI">
            <Form.Item name={[fieldName, 'tlsSettings', 'serverName']} noStyle>
              <Input disabled={overrideSniFromAddress || keepSniBlank} />
            </Form.Item>
          </ProfileSecurityField>
          <ProfileSecurityField label={t('pages.hosts.fields.overrideSniFromAddress')}>
            <Form.Item
              name={[fieldName, 'overrideSniFromAddress']}
              valuePropName="checked"
              noStyle
            >
              <Switch
                onChange={(checked) => {
                  if (checked) {
                    form.setFieldValue([...absoluteBase, 'keepSniBlank'], false);
                  }
                }}
              />
            </Form.Item>
          </ProfileSecurityField>
          <ProfileSecurityField label={t('pages.hosts.fields.keepSniBlank')}>
            <Form.Item
              name={[fieldName, 'keepSniBlank']}
              valuePropName="checked"
              noStyle
            >
              <Switch
                onChange={(checked) => {
                  if (checked) {
                    form.setFieldValue(
                      [...absoluteBase, 'overrideSniFromAddress'],
                      false,
                    );
                  }
                }}
              />
            </Form.Item>
          </ProfileSecurityField>
          <ProfileSecurityField label="uTLS">
            <Form.Item
              name={[fieldName, 'tlsSettings', 'settings', 'fingerprint']}
              noStyle
            >
              <Select
                options={Object.values(UTLS_FINGERPRINT).map((value) => ({
                  value,
                  label: value,
                }))}
              />
            </Form.Item>
          </ProfileSecurityField>
          <ProfileSecurityField label="ALPN">
            <Form.Item name={[fieldName, 'tlsSettings', 'alpn']} noStyle>
              <Select
                mode="multiple"
                options={Object.values(ALPN_OPTION).map((value) => ({
                  value,
                  label: value,
                }))}
              />
            </Form.Item>
          </ProfileSecurityField>
          <ProfileSecurityField label={t('pages.inbounds.form.allowInsecure')}>
            <Form.Item
              name={[fieldName, 'tlsSettings', 'settings', 'allowInsecure']}
              valuePropName="checked"
              noStyle
            >
              <Switch />
            </Form.Item>
          </ProfileSecurityField>
          <ProfileSecurityField
            label={t('pages.inbounds.form.verifyPeerCertByName')}
            hint={t('pages.inbounds.form.verifyPeerCertByNameTip')}
          >
            <Form.Item
              name={[
                fieldName,
                'tlsSettings',
                'settings',
                'verifyPeerCertByName',
              ]}
              noStyle
            >
              <Input placeholder="example.com" />
            </Form.Item>
          </ProfileSecurityField>
          <ProfileSecurityField label={t('pages.inbounds.form.echConfig')}>
            <Form.Item
              name={[fieldName, 'tlsSettings', 'settings', 'echConfigList']}
              noStyle
            >
              <Input />
            </Form.Item>
          </ProfileSecurityField>
          <ProfileSecurityField
            label={t('pages.inbounds.form.pinnedPeerCertSha256')}
            hint={t('pages.inbounds.form.pinnedPeerCertSha256Tip')}
          >
            <div className="ext-proxy-security-input-actions ext-proxy-security-input-actions--icons">
              <Form.Item
                name={[
                  fieldName,
                  'tlsSettings',
                  'settings',
                  'pinnedPeerCertSha256',
                ]}
                noStyle
              >
                <Select
                  mode="tags"
                  tokenSeparators={[',', ' ']}
                  placeholder={t(
                    'pages.inbounds.form.pinnedPeerCertSha256Placeholder',
                  )}
                />
              </Form.Item>
              <Button
                icon={<FileProtectOutlined />}
                onClick={actions.pinFromRuntimeCertificate}
                loading={actions.securityBusy}
                title={t('pages.inbounds.form.pinFromCert')}
                aria-label={t('pages.inbounds.form.pinFromCert')}
              />
              <Button
                icon={<CloudDownloadOutlined />}
                onClick={actions.pinFromRemoteCertificate}
                loading={actions.securityBusy}
                title={t('pages.inbounds.form.pinFromRemote')}
                aria-label={t('pages.inbounds.form.pinFromRemote')}
              />
            </div>
          </ProfileSecurityField>
        </div>
      </ProfileSecurityBlock>
    );
  }

  if (security === 'reality') {
    return (
      <ProfileSecurityBlock
        className="ext-proxy-security-block--client"
        title={t('pages.inbounds.form.profileClientRealitySettings', {
          defaultValue: 'Client REALITY settings',
        })}
        description={t('pages.inbounds.form.profileClientRealitySettingsHint', {
          defaultValue: 'Public connection values included in this subscription profile.',
        })}
      >
        <div className="ext-proxy-security-form ext-proxy-security-form--client">
          <ProfileSecurityField label="SNI">
            <Form.Item
              name={[fieldName, 'realitySettings', 'serverNames']}
              rules={[{ required: true, type: 'array', min: 1 }]}
              noStyle
            >
              <Select
                mode="tags"
                tokenSeparators={[',', ' ']}
                onChange={(values: string[]) => {
                  const preferredPath = [
                    ...absoluteBase,
                    'realitySettings',
                    'settings',
                    'serverName',
                  ];
                  form.setFieldValue(
                    preferredPath,
                    resolvePreferredRealityValue(
                      values,
                      form.getFieldValue(preferredPath),
                    ),
                  );
                }}
              />
            </Form.Item>
          </ProfileSecurityField>
          <ProfileSecurityField label={t('pages.inbounds.form.preferredRealitySni')}>
            <Form.Item
              name={[fieldName, 'realitySettings', 'settings', 'serverName']}
              noStyle
            >
              <Select
                allowClear
                options={realityServerNames.map((value) => ({ value, label: value }))}
              />
            </Form.Item>
          </ProfileSecurityField>
          <ProfileSecurityField label="uTLS">
            <Form.Item
              name={[fieldName, 'realitySettings', 'settings', 'fingerprint']}
              noStyle
            >
              <Select
                options={Object.values(UTLS_FINGERPRINT).map((value) => ({
                  value,
                  label: value,
                }))}
              />
            </Form.Item>
          </ProfileSecurityField>
          <ProfileSecurityField label={t('pages.inbounds.form.shortIds')}>
            <div className="ext-proxy-security-input-actions ext-proxy-security-input-actions--icons">
              <Form.Item
                name={[fieldName, 'realitySettings', 'shortIds']}
                rules={[
                  {
                    validator: (_, values: unknown) => {
                      if (!Array.isArray(values)) return Promise.resolve();
                      return values.every(isRealityShortIdValid)
                        ? Promise.resolve()
                        : Promise.reject(
                          new Error(
                            t('pages.inbounds.form.profileRealityShortIdError'),
                          ),
                        );
                    },
                  },
                ]}
                noStyle
              >
                <Select
                  mode="tags"
                  tokenSeparators={[',', ' ']}
                  onChange={(values: string[]) => {
                    if (form.getFieldValue([
                      ...absoluteBase,
                      'runtime',
                      'realitySettings',
                    ]) != null) {
                      form.setFieldValue(
                        [
                          ...absoluteBase,
                          'runtime',
                          'realitySettings',
                          'shortIds',
                        ],
                        values,
                      );
                    }
                    const preferredPath = [
                      ...absoluteBase,
                      'realitySettings',
                      'settings',
                      'shortId',
                    ];
                    form.setFieldValue(
                      preferredPath,
                      resolvePreferredRealityValue(
                        values,
                        form.getFieldValue(preferredPath),
                      ),
                    );
                  }}
                />
              </Form.Item>
              <Button
                aria-label={t('regenerate')}
                title={t('regenerate')}
                icon={<ReloadOutlined />}
                onClick={actions.randomizeShortIds}
              />
            </div>
          </ProfileSecurityField>
          <ProfileSecurityField
            label={t('pages.inbounds.form.preferredRealityShortId')}
          >
            <Form.Item
              name={[fieldName, 'realitySettings', 'settings', 'shortId']}
              noStyle
            >
              <Select
                allowClear
                options={realityShortIds.map((value) => ({ value, label: value }))}
              />
            </Form.Item>
          </ProfileSecurityField>
          <ProfileSecurityField label={t('pages.inbounds.publicKey')}>
            <Form.Item
              name={[fieldName, 'realitySettings', 'settings', 'publicKey']}
              noStyle
            >
              <Input.TextArea autoSize={{ minRows: 1, maxRows: 4 }} />
            </Form.Item>
            <Space className="ext-proxy-security-actions" size={8} wrap>
              <Button
                size="small"
                type="primary"
                ghost
                loading={actions.securityBusy}
                onClick={actions.generateRealityKeypair}
              >
                {t('pages.inbounds.form.getNewCert')}
              </Button>
              <Button size="small" danger onClick={actions.clearRealityKeypair}>
                {t('clear')}
              </Button>
            </Space>
          </ProfileSecurityField>
          <ProfileSecurityField
            label={t('pages.inbounds.form.spiderX')}
            hint={t('pages.inbounds.form.spiderXHint')}
          >
            <div className="ext-proxy-security-input-actions ext-proxy-security-input-actions--icons">
              <Form.Item
                name={[fieldName, 'realitySettings', 'settings', 'spiderX']}
                noStyle
              >
                <Input />
              </Form.Item>
              <Button
                aria-label={t('regenerate')}
                title={t('regenerate')}
                icon={<ReloadOutlined />}
                onClick={actions.randomizeSpiderX}
              />
            </div>
          </ProfileSecurityField>
          <ProfileSecurityField label={t('pages.inbounds.form.mldsa65Verify')}>
            <Form.Item
              name={[fieldName, 'realitySettings', 'settings', 'mldsa65Verify']}
              noStyle
            >
              <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} />
            </Form.Item>
            <Space className="ext-proxy-security-actions" size={8} wrap>
              <Button
                size="small"
                type="primary"
                ghost
                loading={actions.securityBusy}
                onClick={actions.generateMldsa65}
              >
                {t('pages.inbounds.form.getNewSeed')}
              </Button>
              <Button size="small" danger onClick={actions.clearMldsa65}>
                {t('clear')}
              </Button>
            </Space>
          </ProfileSecurityField>
        </div>
      </ProfileSecurityBlock>
    );
  }

  return (
    <ProfileSecurityStatus tone="warning">
      {t('pages.inbounds.form.unsupportedProfileSecurity')}
    </ProfileSecurityStatus>
  );
}

interface ProfileRuntimeServerSecurityFieldsProps {
  fieldName: number;
  absoluteBase: (string | number)[];
  security: string;
  inheritedSecurity: string;
  required: boolean;
  settings?: Record<string, unknown>;
  form: FormInstance;
  actions: SubscriptionProfileSecurityActions;
}

export function ProfileRuntimeServerSecurityFields({
  fieldName,
  absoluteBase,
  security,
  inheritedSecurity,
  required,
  settings,
  form,
  actions,
}: ProfileRuntimeServerSecurityFieldsProps) {
  const { t } = useTranslation();

  if (security === 'none') {
    return (
      <ProfileSecurityStatus>
        {t('pages.inbounds.form.profileRuntimeNoServerSecurity')}
      </ProfileSecurityStatus>
    );
  }

  const overrideEnabled = settings != null;
  const toggleOverride = (checked: boolean) => {
    if (!checked && !required) {
      form.setFieldValue(
        [
          ...absoluteBase,
          'runtime',
          security === 'tls' ? 'tlsSettings' : 'realitySettings',
        ],
        undefined,
      );
      return;
    }
    form.setFieldValue(
      [
        ...absoluteBase,
        'runtime',
        security === 'tls' ? 'tlsSettings' : 'realitySettings',
      ],
      security === 'tls'
        ? createProfileRuntimeTlsDefaults()
        : createProfileRuntimeRealityDefaults(),
    );
  };

  const description = required
    ? t('pages.inbounds.form.profileRuntimeServerSecurityRequired')
    : t('pages.inbounds.form.profileRuntimeServerSecurityHint', {
      security: inheritedSecurity.toUpperCase(),
    });

  return (
    <ProfileSecurityBlock
      className="ext-proxy-security-block--server ext-proxy-runtime-security"
      title={t('pages.inbounds.form.profileRuntimeServerSecurity')}
      description={description}
      action={(
        <div className="ext-proxy-security-override">
          {required && (
            <span className="ext-proxy-security-required">
              {t('required', { defaultValue: 'Required' })}
            </span>
          )}
          <Switch
            checked={overrideEnabled}
            disabled={required}
            onChange={toggleOverride}
            aria-label={t('pages.inbounds.form.profileRuntimeServerSecurity')}
          />
        </div>
      )}
    >
      {!overrideEnabled ? (
        <ProfileSecurityStatus tone="success">
          {t('pages.inbounds.form.profileRuntimeInheritsServerSecurity', {
            security: inheritedSecurity.toUpperCase(),
          })}
        </ProfileSecurityStatus>
      ) : security === 'tls' ? (
        <ProfileRuntimeTlsFields
          fieldName={fieldName}
          absoluteBase={absoluteBase}
          form={form}
          actions={actions}
        />
      ) : (
        <ProfileRuntimeRealityFields
          fieldName={fieldName}
          absoluteBase={absoluteBase}
          form={form}
          actions={actions}
        />
      )}
    </ProfileSecurityBlock>
  );
}

interface RuntimeSecuritySectionProps {
  fieldName: number;
  absoluteBase: (string | number)[];
  form: FormInstance;
  actions: SubscriptionProfileSecurityActions;
}

function ProfileRuntimeTlsFields({
  fieldName,
  absoluteBase,
  form,
  actions,
}: RuntimeSecuritySectionProps) {
  const { t } = useTranslation();
  const echSockopt = Form.useWatch(
    [...absoluteBase, 'runtime', 'tlsSettings', 'echSockopt'],
    form,
  );
  const minVersion = Form.useWatch(
    [...absoluteBase, 'runtime', 'tlsSettings', 'minVersion'],
    form,
  );
  const maxVersion = Form.useWatch(
    [...absoluteBase, 'runtime', 'tlsSettings', 'maxVersion'],
    form,
  );

  return (
    <div className="ext-proxy-security-form ext-proxy-security-form--runtime">
      {!isTlsVersionRangeValid(minVersion, maxVersion) && (
        <Alert
          className="ext-proxy-security-wide ext-proxy-security-alert"
          type="error"
          showIcon
          title={t('pages.inbounds.form.profileTlsVersionRangeError')}
        />
      )}
      <ProfileSecurityField label={t('pages.inbounds.form.cipherSuites')}>
        <Form.Item
          name={[fieldName, 'runtime', 'tlsSettings', 'cipherSuites']}
          noStyle
        >
          <Select
            options={[
              { value: '', label: t('pages.inbounds.form.autoOption') },
              ...Object.entries(TLS_CIPHER_OPTION).map(([label, value]) => ({
                value,
                label,
              })),
            ]}
          />
        </Form.Item>
      </ProfileSecurityField>
      <ProfileSecurityField label={t('pages.inbounds.form.minMaxVersion')}>
        <Space.Compact block>
          <Form.Item
            name={[fieldName, 'runtime', 'tlsSettings', 'minVersion']}
            noStyle
          >
            <Select
              style={{ width: '50%' }}
              options={Object.values(TLS_VERSION_OPTION).map((value) => ({
                value,
                label: value,
              }))}
            />
          </Form.Item>
          <Form.Item
            name={[fieldName, 'runtime', 'tlsSettings', 'maxVersion']}
            rules={[
              {
                validator: (_, value) => (
                  isTlsVersionRangeValid(minVersion, value)
                    ? Promise.resolve()
                    : Promise.reject(
                      new Error(t('pages.inbounds.form.profileTlsVersionRangeError')),
                    )
                ),
              },
            ]}
            noStyle
          >
            <Select
              style={{ width: '50%' }}
              options={Object.values(TLS_VERSION_OPTION).map((value) => ({
                value,
                label: value,
              }))}
            />
          </Form.Item>
        </Space.Compact>
      </ProfileSecurityField>
      <ProfileSecurityField label="ALPN">
        <Form.Item
          name={[fieldName, 'runtime', 'tlsSettings', 'alpn']}
          noStyle
        >
          <Select
            mode="multiple"
            options={Object.values(ALPN_OPTION).map((value) => ({
              value,
              label: value,
            }))}
          />
        </Form.Item>
      </ProfileSecurityField>
      <ProfileSecurityField
        label={t('pages.inbounds.form.curvePreferences')}
        hint={t('pages.inbounds.form.curvePreferencesTip')}
      >
        <Form.Item
          name={[fieldName, 'runtime', 'tlsSettings', 'curvePreferences']}
          noStyle
        >
          <Select
            mode="tags"
            tokenSeparators={[',', ' ']}
            options={[
              'X25519MLKEM768',
              'X25519',
              'P-256',
              'P-384',
              'P-521',
            ].map((value) => ({ value, label: value }))}
          />
        </Form.Item>
      </ProfileSecurityField>
      <ProfileSecurityField label={t('pages.inbounds.form.rejectUnknownSni')}>
        <Form.Item
          name={[fieldName, 'runtime', 'tlsSettings', 'rejectUnknownSni']}
          valuePropName="checked"
          noStyle
        >
          <Switch />
        </Form.Item>
      </ProfileSecurityField>
      <ProfileSecurityField label={t('pages.inbounds.form.disableSystemRoot')}>
        <Form.Item
          name={[fieldName, 'runtime', 'tlsSettings', 'disableSystemRoot']}
          valuePropName="checked"
          noStyle
        >
          <Switch />
        </Form.Item>
      </ProfileSecurityField>
      <ProfileSecurityField label={t('pages.inbounds.form.sessionResumption')}>
        <Form.Item
          name={[
            fieldName,
            'runtime',
            'tlsSettings',
            'enableSessionResumption',
          ]}
          valuePropName="checked"
          noStyle
        >
          <Switch />
        </Form.Item>
      </ProfileSecurityField>

      <Form.List name={[fieldName, 'runtime', 'tlsSettings', 'certificates']}>
        {(fields, { add, remove }) => (
          <>
            <ProfileSecurityField label={t('certificate')}>
              <Button
                type="primary"
                size="small"
                aria-label={t('add')}
                icon={<PlusOutlined />}
                onClick={() => add(createProfileTlsCertificateDraft())}
              />
            </ProfileSecurityField>
            <div className="ext-proxy-certificate-list ext-proxy-security-wide">
              {fields.map((field, index) => (
                <ProfileTlsCertificateRow
                  key={field.key}
                  certificateFieldName={field.name}
                  certificateIndex={index}
                  total={fields.length}
                  absoluteBase={absoluteBase}
                  form={form}
                  actions={actions}
                  onRemove={() => remove(field.name)}
                />
              ))}
            </div>
          </>
        )}
      </Form.List>

      <ProfileSecurityField
        label={t('pages.inbounds.form.masterKeyLog')}
        hint={t('pages.inbounds.form.masterKeyLogTip')}
      >
        <Form.Item
          name={[fieldName, 'runtime', 'tlsSettings', 'masterKeyLog']}
          noStyle
        >
          <Input placeholder="/path/to/sslkeylog.txt" />
        </Form.Item>
      </ProfileSecurityField>
      <ProfileSecurityField
        label={t('pages.inbounds.form.echSockopt')}
        hint={t('pages.inbounds.form.echSockoptTip')}
      >
        <Switch
          checked={echSockopt != null}
          onChange={(checked) => {
            form.setFieldValue(
              [...absoluteBase, 'runtime', 'tlsSettings', 'echSockopt'],
              checked ? SockoptStreamSettingsSchema.parse({}) : undefined,
            );
          }}
        />
      </ProfileSecurityField>

      {echSockopt != null && (
        <div className="ext-proxy-security-subsection">
          <ProfileSecurityField label={t('pages.inbounds.form.dialerProxy')}>
            <Form.Item
              name={[
                fieldName,
                'runtime',
                'tlsSettings',
                'echSockopt',
                'dialerProxy',
              ]}
              noStyle
            >
              <Input />
            </Form.Item>
          </ProfileSecurityField>
          <ProfileSecurityField label={t('pages.xray.wireguard.domainStrategy')}>
            <Form.Item
              name={[
                fieldName,
                'runtime',
                'tlsSettings',
                'echSockopt',
                'domainStrategy',
              ]}
              noStyle
            >
              <Select
                options={Object.values(DOMAIN_STRATEGY_OPTION).map((value) => ({
                  value,
                  label: value,
                }))}
              />
            </Form.Item>
          </ProfileSecurityField>
          <ProfileSecurityField label={t('pages.inbounds.form.tcpFastOpen')}>
            <Form.Item
              name={[
                fieldName,
                'runtime',
                'tlsSettings',
                'echSockopt',
                'tcpFastOpen',
              ]}
              valuePropName="checked"
              noStyle
            >
              <Switch />
            </Form.Item>
          </ProfileSecurityField>
          <ProfileSecurityField label={t('pages.inbounds.form.multipathTcp')}>
            <Form.Item
              name={[
                fieldName,
                'runtime',
                'tlsSettings',
                'echSockopt',
                'tcpMptcp',
              ]}
              valuePropName="checked"
              noStyle
            >
              <Switch />
            </Form.Item>
          </ProfileSecurityField>
        </div>
      )}

      <ProfileSecurityField label={t('pages.inbounds.form.echKey')}>
        <Form.Item
          name={[fieldName, 'runtime', 'tlsSettings', 'echServerKeys']}
          noStyle
        >
          <Input />
        </Form.Item>
        <Space className="ext-proxy-security-actions" size={8} wrap>
          <Button
            size="small"
            type="primary"
            ghost
            loading={actions.securityBusy}
            onClick={actions.generateEch}
          >
            {t('pages.inbounds.form.getNewEchCert')}
          </Button>
          <Button size="small" danger onClick={actions.clearEch}>
            {t('clear')}
          </Button>
        </Space>
      </ProfileSecurityField>
    </div>
  );
}

interface ProfileTlsCertificateRowProps {
  certificateFieldName: number;
  certificateIndex: number;
  total: number;
  absoluteBase: (string | number)[];
  form: FormInstance;
  actions: SubscriptionProfileSecurityActions;
  onRemove: () => void;
}

function ProfileTlsCertificateRow({
  certificateFieldName,
  certificateIndex,
  total,
  absoluteBase,
  form,
  actions,
  onRemove,
}: ProfileTlsCertificateRowProps) {
  const { t } = useTranslation();
  const certificateBase = [
    ...absoluteBase,
    'runtime',
    'tlsSettings',
    'certificates',
    certificateFieldName,
  ];
  const certificate = Form.useWatch(
    certificateBase,
    { form, preserve: true },
  ) as Record<string, unknown> | undefined;
  const explicitUseFile = certificate?.useFile;
  const useFile = typeof explicitUseFile === 'boolean'
    ? explicitUseFile
    : !Array.isArray(certificate?.certificate)
      || certificate.certificate.length === 0;
  const usage = String(certificate?.usage ?? 'encipherment');

  const switchMode = (nextUseFile: boolean) => {
    form.setFieldValue([...certificateBase, 'useFile'], nextUseFile);
    if (nextUseFile) {
      form.setFieldValue([...certificateBase, 'certificate'], []);
      form.setFieldValue([...certificateBase, 'key'], []);
    } else {
      form.setFieldValue([...certificateBase, 'certificateFile'], '');
      form.setFieldValue([...certificateBase, 'keyFile'], '');
    }
  };

  return (
    <section className="ext-proxy-certificate">
      <div className="ext-proxy-certificate__head">
        <div className="ext-proxy-certificate__identity">
          <strong className="ext-proxy-certificate__title">
            {`${t('certificate')} ${certificateIndex + 1}`}
          </strong>
          <Radio.Group
            value={useFile}
            buttonStyle="solid"
            onChange={(event) => switchMode(event.target.value === true)}
          >
            <Radio.Button value={true}>
              {t('pages.inbounds.certificatePath')}
            </Radio.Button>
            <Radio.Button value={false}>
              {t('pages.inbounds.certificateContent')}
            </Radio.Button>
          </Radio.Group>
        </div>
        {total > 1 && (
          <Button danger size="small" onClick={onRemove}>
            <MinusOutlined /> {t('remove')}
          </Button>
        )}
      </div>

      <div className="ext-proxy-security-form ext-proxy-security-form--certificate">
        {useFile ? (
          <>
            <ProfileSecurityField label={t('pages.inbounds.publicKey')}>
              <Form.Item
                name={[certificateFieldName, 'certificateFile']}
                rules={[{ required: true }]}
                noStyle
              >
                <Input />
              </Form.Item>
            </ProfileSecurityField>
            <ProfileSecurityField label={t('pages.inbounds.privatekey')}>
              <Form.Item
                name={[certificateFieldName, 'keyFile']}
                rules={[{ required: true }]}
                noStyle
              >
                <Input />
              </Form.Item>
            </ProfileSecurityField>
            <ProfileSecurityField label=" ">
              <Space wrap>
                <Button
                  type="primary"
                  loading={actions.securityBusy}
                  onClick={() => actions.setRuntimeCertFromPanel(certificateFieldName)}
                >
                  {t('pages.inbounds.setDefaultCert')}
                </Button>
                <Button
                  danger
                  onClick={() => actions.clearRuntimeCertFiles(certificateFieldName)}
                >
                  {t('clear')}
                </Button>
              </Space>
            </ProfileSecurityField>
          </>
        ) : (
          <>
            <ProfileSecurityField label={t('pages.inbounds.publicKey')}>
              <Form.Item
                name={[certificateFieldName, 'certificate']}
                getValueProps={(value) => ({ value: pemLinesToText(value) })}
                normalize={pemTextToLines}
                rules={[{ required: true }]}
                noStyle
              >
                <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} />
              </Form.Item>
            </ProfileSecurityField>
            <ProfileSecurityField label={t('pages.inbounds.privatekey')}>
              <Form.Item
                name={[certificateFieldName, 'key']}
                getValueProps={(value) => ({ value: pemLinesToText(value) })}
                normalize={pemTextToLines}
                rules={[{ required: true }]}
                noStyle
              >
                <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} />
              </Form.Item>
            </ProfileSecurityField>
          </>
        )}

        <ProfileSecurityField label="OCSP Stapling">
          <Form.Item
            name={[certificateFieldName, 'ocspStapling']}
            noStyle
          >
            <InputNumber min={0} suffix="s" style={{ width: '100%' }} />
          </Form.Item>
        </ProfileSecurityField>
        <ProfileSecurityField label={t('pages.inbounds.form.oneTimeLoading')}>
          <Form.Item
            name={[certificateFieldName, 'oneTimeLoading']}
            valuePropName="checked"
            noStyle
          >
            <Switch />
          </Form.Item>
        </ProfileSecurityField>
        <ProfileSecurityField label={t('pages.inbounds.form.usageOption')}>
          <Form.Item
            name={[certificateFieldName, 'usage']}
            noStyle
          >
            <Select
              options={Object.values(USAGE_OPTION).map((value) => ({
                value,
                label: value,
              }))}
            />
          </Form.Item>
        </ProfileSecurityField>
        {usage === 'issue' && (
          <ProfileSecurityField label={t('pages.inbounds.form.buildChain')}>
            <Form.Item
              name={[certificateFieldName, 'buildChain']}
              valuePropName="checked"
              noStyle
            >
              <Switch />
            </Form.Item>
          </ProfileSecurityField>
        )}
      </div>
    </section>
  );
}

function ProfileRuntimeRealityFields({
  fieldName,
  absoluteBase,
  form,
  actions,
}: RuntimeSecuritySectionProps) {
  const { t } = useTranslation();
  const [scannerOpen, setScannerOpen] = useState(false);
  const minClientVersion = Form.useWatch(
    [...absoluteBase, 'runtime', 'realitySettings', 'minClientVer'],
    form,
  );
  const maxClientVersion = Form.useWatch(
    [...absoluteBase, 'runtime', 'realitySettings', 'maxClientVer'],
    form,
  );

  return (
    <>
      {isClientVersionValid(minClientVersion)
        && isClientVersionValid(maxClientVersion)
        && !isClientVersionRangeValid(minClientVersion, maxClientVersion) && (
        <Alert
          className="ext-proxy-security-alert"
          type="error"
          showIcon
          title={t('pages.inbounds.form.profileRealityClientVersionRangeError')}
        />
      )}
      <div className="ext-proxy-security-form ext-proxy-security-form--runtime">
        <ProfileSecurityField label={t('pages.inbounds.form.show')}>
          <Form.Item
            name={[fieldName, 'runtime', 'realitySettings', 'show']}
            valuePropName="checked"
            noStyle
          >
            <Switch />
          </Form.Item>
        </ProfileSecurityField>
        <ProfileSecurityField label={t('pages.inbounds.form.xver')}>
          <Form.Item
            name={[fieldName, 'runtime', 'realitySettings', 'xver']}
            noStyle
          >
            <InputNumber min={0} className="ext-proxy-security-control--short" />
          </Form.Item>
        </ProfileSecurityField>
        <ProfileSecurityField
          label={t('pages.inbounds.form.target')}
          hint={t('pages.inbounds.form.realityTargetHint')}
        >
          <div className="ext-proxy-security-target">
            <Form.Item
              name={[fieldName, 'runtime', 'realitySettings', 'target']}
              rules={[
                { required: true },
                {
                  validator: (_, value) => {
                    const errorKey = validateRealityTarget(
                      typeof value === 'string' ? value : '',
                    );
                    return errorKey
                      ? Promise.reject(new Error(t(errorKey)))
                      : Promise.resolve();
                  },
                },
              ]}
              noStyle
            >
              <Input placeholder="example.com:443" />
            </Form.Item>
            <Button
              icon={<RadarChartOutlined />}
              loading={actions.scanning}
              onClick={actions.scanRealityTarget}
            >
              {t('pages.inbounds.form.scan')}
            </Button>
            <Button
              icon={<SearchOutlined />}
              onClick={() => setScannerOpen(true)}
            >
              {t('pages.inbounds.form.findTargets')}
            </Button>
          </div>
        </ProfileSecurityField>

        {actions.scanResult && (
          <Alert
            className="ext-proxy-security-wide ext-proxy-security-alert"
            type={actions.scanResult.feasible ? 'success' : 'warning'}
            showIcon
            title={
              actions.scanResult.feasible
                ? t('pages.inbounds.form.scanFeasible')
                : actions.scanResult.reason
                  || t('pages.inbounds.form.scanNotFeasible')
            }
            description={(
              <Descriptions size="small" column={1}>
                <Descriptions.Item label="TLS">
                  {actions.scanResult.tlsVersion || '—'}
                </Descriptions.Item>
                <Descriptions.Item label="ALPN">
                  {actions.scanResult.alpn || '—'}
                </Descriptions.Item>
                <Descriptions.Item label={t('pages.inbounds.form.scanCurve')}>
                  {actions.scanResult.curveID || '—'}
                </Descriptions.Item>
                <Descriptions.Item label={t('pages.inbounds.form.scanCert')}>
                  {actions.scanResult.certValid
                    ? `${actions.scanResult.certSubject} (${actions.scanResult.certIssuer})`
                    : t('pages.inbounds.form.scanCertInvalid')}
                </Descriptions.Item>
                <Descriptions.Item label={t('pages.inbounds.form.scanLatency')}>
                  {actions.scanResult.latencyMs > 0
                    ? `${actions.scanResult.latencyMs} ms`
                    : '—'}
                </Descriptions.Item>
              </Descriptions>
            )}
          />
        )}

        <ProfileSecurityField label={t('pages.inbounds.form.maxTimeDiff')}>
          <Form.Item
            name={[fieldName, 'runtime', 'realitySettings', 'maxTimediff']}
            noStyle
          >
            <InputNumber min={0} className="ext-proxy-security-control--short" />
          </Form.Item>
        </ProfileSecurityField>
        <ProfileSecurityField label={t('pages.inbounds.form.minClientVer')}>
          <Form.Item
            name={[fieldName, 'runtime', 'realitySettings', 'minClientVer']}
            rules={[
              {
                validator: (_, value) => (
                  isClientVersionValid(value)
                    ? Promise.resolve()
                    : Promise.reject(
                      new Error(t('pages.inbounds.form.profileRealityClientVersionError')),
                    )
                ),
              },
            ]}
            noStyle
          >
            <Input placeholder="26.3.27" />
          </Form.Item>
        </ProfileSecurityField>
        <ProfileSecurityField label={t('pages.inbounds.form.maxClientVer')}>
          <Form.Item
            name={[fieldName, 'runtime', 'realitySettings', 'maxClientVer']}
            rules={[
              {
                validator: (_, value) => {
                  if (!isClientVersionValid(value)) {
                    return Promise.reject(
                      new Error(t('pages.inbounds.form.profileRealityClientVersionError')),
                    );
                  }
                  return isClientVersionRangeValid(minClientVersion, value)
                    ? Promise.resolve()
                    : Promise.reject(
                      new Error(
                        t('pages.inbounds.form.profileRealityClientVersionRangeError'),
                      ),
                    );
                },
              },
            ]}
            noStyle
          >
            <Input placeholder="25.9.11" />
          </Form.Item>
        </ProfileSecurityField>
        <ProfileSecurityField label={t('pages.inbounds.form.shortIds')}>
          <div className="ext-proxy-security-input-actions ext-proxy-security-input-actions--icons">
            <Form.Item
              name={[fieldName, 'runtime', 'realitySettings', 'shortIds']}
              rules={[
                {
                  validator: (_, values: unknown) => {
                    if (!Array.isArray(values)) return Promise.resolve();
                    return values.every(isRealityShortIdValid)
                      ? Promise.resolve()
                      : Promise.reject(
                        new Error(t('pages.inbounds.form.profileRealityShortIdError')),
                      );
                  },
                },
              ]}
              noStyle
            >
              <Select
                mode="tags"
                tokenSeparators={[',', ' ']}
                onChange={(values: string[]) => {
                  form.setFieldValue(
                    [...absoluteBase, 'realitySettings', 'shortIds'],
                    values,
                  );
                  const preferredPath = [
                    ...absoluteBase,
                    'realitySettings',
                    'settings',
                    'shortId',
                  ];
                  form.setFieldValue(
                    preferredPath,
                    resolvePreferredRealityValue(
                      values,
                      form.getFieldValue(preferredPath),
                    ),
                  );
                }}
              />
            </Form.Item>
            <Button
              aria-label={t('regenerate')}
              title={t('regenerate')}
              icon={<ReloadOutlined />}
              onClick={actions.randomizeShortIds}
            />
          </div>
        </ProfileSecurityField>
        <ProfileSecurityField label={t('pages.inbounds.privatekey')}>
          <Form.Item
            name={[fieldName, 'runtime', 'realitySettings', 'privateKey']}
            rules={[{ required: true }]}
            noStyle
          >
            <Input.TextArea autoSize={{ minRows: 1, maxRows: 4 }} />
          </Form.Item>
          <Space className="ext-proxy-security-actions" size={8} wrap>
            <Button
              size="small"
              type="primary"
              ghost
              loading={actions.securityBusy}
              onClick={actions.generateRealityKeypair}
            >
              {t('pages.inbounds.form.getNewCert')}
            </Button>
            <Button size="small" danger onClick={actions.clearRealityKeypair}>
              {t('clear')}
            </Button>
          </Space>
        </ProfileSecurityField>
        <ProfileSecurityField label={t('pages.inbounds.form.mldsa65Seed')}>
          <Form.Item
            name={[fieldName, 'runtime', 'realitySettings', 'mldsa65Seed']}
            noStyle
          >
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} />
          </Form.Item>
          <Space className="ext-proxy-security-actions" size={8} wrap>
            <Button
              size="small"
              type="primary"
              ghost
              loading={actions.securityBusy}
              onClick={actions.generateMldsa65}
            >
              {t('pages.inbounds.form.getNewSeed')}
            </Button>
            <Button size="small" danger onClick={actions.clearMldsa65}>
              {t('clear')}
            </Button>
          </Space>
        </ProfileSecurityField>
        <ProfileSecurityField
          label={t('pages.inbounds.form.masterKeyLog')}
          hint={t('pages.inbounds.form.masterKeyLogTip')}
        >
          <Form.Item
            name={[fieldName, 'runtime', 'realitySettings', 'masterKeyLog']}
            noStyle
          >
            <Input placeholder="/path/to/sslkeylog.txt" />
          </Form.Item>
        </ProfileSecurityField>
      </div>

      <Collapse
        className="ext-proxy-security-collapse"
        items={[
          {
            key: 'limitFallback',
            label: t('pages.inbounds.form.limitFallback'),
            children: (
              <div className="ext-proxy-security-fallbacks">
                {([
                  'limitFallbackUpload',
                  'limitFallbackDownload',
                ] as const).map((direction) => (
                  <section key={direction} className="ext-proxy-security-fallback">
                    <Divider>{t(`pages.inbounds.form.${direction}`)}</Divider>
                    <div className="ext-proxy-security-form ext-proxy-security-form--compact">
                      <ProfileSecurityField
                        label={t('pages.inbounds.form.afterBytes')}
                        hint={t('pages.inbounds.form.afterBytesTip')}
                      >
                        <Form.Item
                          name={[
                            fieldName,
                            'runtime',
                            'realitySettings',
                            direction,
                            'afterBytes',
                          ]}
                          noStyle
                        >
                          <InputNumber min={0} />
                        </Form.Item>
                      </ProfileSecurityField>
                      <ProfileSecurityField
                        label={t('pages.inbounds.form.bytesPerSec')}
                        hint={t('pages.inbounds.form.bytesPerSecTip')}
                      >
                        <Form.Item
                          name={[
                            fieldName,
                            'runtime',
                            'realitySettings',
                            direction,
                            'bytesPerSec',
                          ]}
                          noStyle
                        >
                          <InputNumber min={0} />
                        </Form.Item>
                      </ProfileSecurityField>
                      <ProfileSecurityField
                        label={t('pages.inbounds.form.burstBytesPerSec')}
                        hint={t('pages.inbounds.form.burstBytesPerSecTip')}
                      >
                        <Form.Item
                          name={[
                            fieldName,
                            'runtime',
                            'realitySettings',
                            direction,
                            'burstBytesPerSec',
                          ]}
                          noStyle
                        >
                          <InputNumber min={0} />
                        </Form.Item>
                      </ProfileSecurityField>
                    </div>
                  </section>
                ))}
              </div>
            ),
          },
        ]}
      />

      <RealityTargetScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        scanRealityCandidates={actions.scanRealityCandidates}
        onPick={actions.applyRealityScanResult}
      />
    </>
  );
}
