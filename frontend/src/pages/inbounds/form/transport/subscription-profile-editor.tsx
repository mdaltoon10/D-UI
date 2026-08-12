import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormContext, useWatch } from 'react-hook-form';
import {
  Alert,
  Button,
  message,
  Form,
  Input,
  InputNumber,
  Radio,
  Select,
  Space,
  Switch,
  Tag,
  Tooltip,
  type FormInstance,
} from 'antd';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CopyOutlined,
  DeleteOutlined,
  RightOutlined,
  DownOutlined,
} from '@ant-design/icons';

import { FinalMaskForm } from '@/lib/xray/forms/transport';
import {
  createProfileTransportDefaults,
  profileTransportSettingsKey,
} from '@/lib/xray/forms/transport/subscription-profile-transport';
import {
  createProfileRuntimeRealityDefaults,
  createProfileRuntimeTlsDefaults,
} from '@/lib/xray/forms/security';
import {
  createMKCPLegacyFinalMask,
  effectiveSubscriptionProfileStream,
  isOnlyDefaultMKCPLegacyFinalMask,
} from '@/lib/xray/subscription-profile';
import {
  SUBSCRIPTION_PROFILE_CAPABILITY_TRANSLATION_KEYS,
  subscriptionProfileCapabilityIssues,
} from '@/lib/xray/subscription-profile-capabilities';
import ClientSockoptForm from '@/pages/hosts/json-forms/HostSockoptForm';
import ProfileSimpleTransportFields from '@/pages/inbounds/form/transport/subscription-profile-simple-transport-fields';
import ProfileRuntimeSockoptFields from '@/pages/inbounds/form/transport/subscription-profile-sockopt-fields';
import ProfileXhttpTransportFields from '@/pages/inbounds/form/transport/subscription-profile-xhttp-fields';
import {
  ProfileClientSecurityFields,
  ProfileRuntimeServerSecurityFields,
  ProfileSecurityStatus,
} from '@/pages/inbounds/form/transport/subscription-profile-security-fields';
import { useSubscriptionProfileSecurityActions } from '@/pages/inbounds/form/transport/use-subscription-profile-security-actions';
import { canEnableReality, canEnableTls } from '@/lib/xray/protocol-capabilities';
import type { StreamSettings } from '@/schemas/api/inbound';
import {
  SubscriptionProfileMuxSchema,
  SubscriptionProfileRealitySettingsSchema,
  SubscriptionProfileTlsSettingsSchema,
  type ExternalProxyEntry,
  type SubscriptionProfileSubType,
} from '@/schemas/protocols/stream/external-proxy';

interface SubscriptionProfileEditorProps {
  fieldName: number;
  displayIndex: number;
  totalProfiles: number;
  form: FormInstance;
  parentNetwork: string;
  parentSecurity: string;
  isDefaultProfile: boolean;
  onRemove: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
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

function Field({ label, children, hint }: {
  label: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="ext-proxy-field">
      <span className="ext-proxy-flabel">{label}</span>
      {children}
      {hint && <span className="ext-proxy-fhint">{hint}</span>}
    </div>
  );
}

export default function SubscriptionProfileEditor({
  fieldName,
  displayIndex,
  totalProfiles,
  form,
  parentNetwork,
  parentSecurity,
  isDefaultProfile,
  onRemove,
  onDuplicate,
  onMoveUp,
  onMoveDown,
}: SubscriptionProfileEditorProps) {
  const { t } = useTranslation();
  const [messageApi, messageContextHolder] = message.useMessage();
  const base = useMemo<(string | number)[]>(
    () => ['streamSettings', 'externalProxy', fieldName],
    [fieldName],
  );

  const { control } = useFormContext();
  const protocol = (useWatch({ control, name: 'protocol' }) ?? '') as string;
  const parentStreamSettings = useWatch({ control, name: 'streamSettings' }) as
    | StreamSettings
    | undefined;
  const watchedProfile = Form.useWatch(
    base,
    { form, preserve: true },
  ) as ExternalProxyEntry | undefined;
  const enabled = Form.useWatch([...base, 'enabled'], form);
  const remark = (Form.useWatch([...base, 'remark'], form) ?? '') as string;
  const destination = (Form.useWatch([...base, 'dest'], form) ?? '') as string;
  const profilePort = (Form.useWatch([...base, 'port'], form) ?? 443) as number;
  const securityActions = useSubscriptionProfileSecurityActions({
    form,
    absoluteBase: base,
    destination,
    profilePort,
    messageApi,
  });
  const selectedNetwork = (Form.useWatch([...base, 'network'], form) ?? 'same') as string;
  const selectedSecurity = (Form.useWatch([...base, 'security'], form) ?? 'same') as string;
  const legacyForceTls = (Form.useWatch([...base, 'forceTls'], form) ?? 'same') as string;
  const finalMask = Form.useWatch([...base, 'finalmask'], { form, preserve: true });
  const mux = Form.useWatch([...base, 'mux'], { form, preserve: true }) as
    | { enabled?: boolean; concurrency?: number; xudpConcurrency?: number; xudpProxyUDP443?: string }
    | undefined;
  const sockopt = Form.useWatch(
    [...base, 'sockopt'],
    { form, preserve: true },
  ) as Record<string, unknown> | undefined;
  const runtime = Form.useWatch(
    [...base, 'runtime'],
    { form, preserve: true },
  ) as {
    id?: string;
    tlsSettings?: Record<string, unknown>;
    realitySettings?: Record<string, unknown>;
    sockopt?: Record<string, unknown>;
  } | undefined;
  const muxMode = mux === undefined ? 'same' : (mux.enabled === false ? 'disabled' : 'enabled');

  const effectiveNetwork = selectedNetwork === 'same' ? parentNetwork : selectedNetwork;
  const effectiveSecurity = selectedSecurity === 'same' ? parentSecurity : selectedSecurity;
  const effectiveProfileStream = useMemo(() => {
    if (!watchedProfile || !parentStreamSettings) return undefined;
    return effectiveSubscriptionProfileStream(
      parentStreamSettings,
      watchedProfile,
      destination,
    );
  }, [destination, parentStreamSettings, watchedProfile]);
  const capabilityIssues = useMemo(
    () => subscriptionProfileCapabilityIssues(watchedProfile, effectiveProfileStream),
    [effectiveProfileStream, watchedProfile],
  );
  const capabilityIssueGroups = useMemo(() => {
    const groups = new Map<SubscriptionProfileSubType, typeof capabilityIssues>();
    for (const issue of capabilityIssues) {
      const current = groups.get(issue.format) ?? [];
      current.push(issue);
      groups.set(issue.format, current);
    }
    return [...groups.entries()];
  }, [capabilityIssues]);
  const runtimeSecuritySettings = effectiveSecurity === 'tls'
    ? runtime?.tlsSettings
    : effectiveSecurity === 'reality'
      ? runtime?.realitySettings
      : undefined;
  const runtimeServerSecurityRequired = effectiveSecurity !== 'none'
    && effectiveSecurity !== parentSecurity;
  const title = remark.trim() || destination.trim()
    || `${t('pages.inbounds.form.subscriptionProfile')} ${displayIndex}`;
  const [profileCollapsed, setProfileCollapsed] = useState(true);

  useEffect(() => {
    if (enabled === undefined) form.setFieldValue([...base, 'enabled'], true);
    if (!form.getFieldValue([...base, 'network'])) {
      form.setFieldValue([...base, 'network'], 'same');
    }
    if (!form.getFieldValue([...base, 'security'])) {
      const migratedSecurity = legacyForceTls !== 'same' ? legacyForceTls : 'same';
      form.setFieldValue([...base, 'security'], migratedSecurity);
    }
  }, [base, enabled, form, legacyForceTls]);

  useEffect(() => {
    if (enabled === false || effectiveSecurity === 'none') return;
    const requiresOwnServerSettings = effectiveSecurity !== parentSecurity;
    if (!requiresOwnServerSettings) return;
    if (effectiveSecurity === 'tls' && !runtime?.tlsSettings) {
      form.setFieldValue(
        [...base, 'runtime', 'tlsSettings'],
        createProfileRuntimeTlsDefaults(),
      );
    }
    if (effectiveSecurity === 'reality' && !runtime?.realitySettings) {
      form.setFieldValue(
        [...base, 'runtime', 'realitySettings'],
        createProfileRuntimeRealityDefaults(),
      );
    }
  }, [
    base,
    effectiveSecurity,
    form,
    parentSecurity,
    runtime?.realitySettings,
    runtime?.tlsSettings,
    enabled,
  ]);

  useEffect(() => {
    if (selectedSecurity !== 'same' || runtimeSecuritySettings == null) return;

    const effectiveProfileRecord = effectiveProfileStream as unknown as
      | Record<string, unknown>
      | undefined;

    if (effectiveSecurity === 'tls') {
      const clientSni = stringValue(
        (effectiveProfileRecord?.tlsSettings as Record<string, unknown> | undefined)
          ?.serverName,
      );
      const serverSni = stringValue(runtime?.tlsSettings?.serverName);
      if (serverSni !== clientSni) {
        form.setFieldValue(
          [...base, 'runtime', 'tlsSettings', 'serverName'],
          clientSni,
        );
      }
      return;
    }

    if (effectiveSecurity === 'reality') {
      const clientNames = stringList(
        (effectiveProfileRecord?.realitySettings as Record<string, unknown> | undefined)
          ?.serverNames,
      );
      const serverNames = stringList(runtime?.realitySettings?.serverNames);
      if (!sameStringList(serverNames, clientNames)) {
        form.setFieldValue(
          [...base, 'runtime', 'realitySettings', 'serverNames'],
          clientNames,
        );
      }
    }
  }, [
    base,
    effectiveProfileStream,
    effectiveSecurity,
    form,
    runtime?.realitySettings,
    runtime?.tlsSettings,
    runtimeSecuritySettings,
    selectedSecurity,
  ]);

  useEffect(() => {
    const security = form.getFieldValue([...base, 'security']);
    if (security !== 'tls') return;
    if (form.getFieldValue([...base, 'tlsSettings'])) return;

    const migrated = SubscriptionProfileTlsSettingsSchema.parse({
      serverName: form.getFieldValue([...base, 'sni']) ?? '',
      alpn: form.getFieldValue([...base, 'alpn']) ?? [],
      settings: {
        fingerprint: form.getFieldValue([...base, 'fingerprint']) || 'chrome',
        echConfigList: form.getFieldValue([...base, 'echConfigList']) ?? '',
        pinnedPeerCertSha256:
          form.getFieldValue([...base, 'pinnedPeerCertSha256']) ?? [],
          verifyPeerCertByName:
            form.getFieldValue(
              [...base, 'verifyPeerCertByName'],
            ) ?? '',
        allowInsecure: form.getFieldValue([...base, 'allowInsecure']) ?? false,
      },
    });
    form.setFieldValue([...base, 'tlsSettings'], migrated);
  }, [base, form, selectedSecurity]);

  const onNetworkChange = (network: string) => {
    const currentFinalMask = form.getFieldValue([...base, 'finalmask']);
    if (network === 'kcp') {
      if (currentFinalMask == null) {
        form.setFieldValue(
          [...base, 'finalmask'],
          createMKCPLegacyFinalMask(),
        );
      }
    } else if (isOnlyDefaultMKCPLegacyFinalMask(currentFinalMask)) {
      form.setFieldValue([...base, 'finalmask'], undefined);
    }

    if (network === 'same') return;
    const key = profileTransportSettingsKey(network);
    if (!key || form.getFieldValue([...base, key])) return;
    form.setFieldValue([...base, key], createProfileTransportDefaults(network));
  };

  const onSecurityChange = (security: string) => {
    form.setFieldValue(
      [...base, 'forceTls'],
      security === 'tls' || security === 'none' ? security : 'same',
    );
    if (security === 'tls' && !form.getFieldValue([...base, 'tlsSettings'])) {
      form.setFieldValue(
        [...base, 'tlsSettings'],
        SubscriptionProfileTlsSettingsSchema.parse({}),
      );
    }
    if (security === 'reality' && !form.getFieldValue([...base, 'realitySettings'])) {
      form.setFieldValue(
        [...base, 'realitySettings'],
        SubscriptionProfileRealitySettingsSchema.parse({}),
      );
    }
  };



  return (
    <>
      {messageContextHolder}
      <div className={`ext-proxy-card${enabled === false ? ' ext-proxy-card--disabled' : ''}${profileCollapsed ? ' ext-proxy-card--collapsed' : ''}`}>
      <div className="ext-proxy-card__head">
        <div className="ext-proxy-card__identity">
          <Form.Item name={[fieldName, 'enabled']} valuePropName="checked" noStyle>
            <Switch size="small" />
          </Form.Item>
          <span className="ext-proxy-card__title">{title}</span>
          <Tag className="ext-proxy-card__summary">{effectiveNetwork.toUpperCase()}</Tag>
          <Tag className="ext-proxy-card__summary">{effectiveSecurity.toUpperCase()}</Tag>
          <Tag>{protocol ? protocol.toUpperCase() : '-'}</Tag>
        </div>

        <Space className="ext-proxy-card__actions" size={2}>
          <Tooltip title={profileCollapsed ? 'Expand profile' : 'Collapse profile'}>
            <Button
              size="small"
              type="text"
              icon={profileCollapsed ? <RightOutlined /> : <DownOutlined />}
              onClick={() => setProfileCollapsed((value) => !value)}
            />
          </Tooltip>
          <Tooltip title={t('pages.inbounds.form.moveProfileUp')}>
            <Button
              size="small"
              type="text"
              icon={<ArrowUpOutlined />}
              disabled={displayIndex <= 2}
              onClick={onMoveUp}
            />
          </Tooltip>
          <Tooltip title={t('pages.inbounds.form.moveProfileDown')}>
            <Button
              size="small"
              type="text"
              icon={<ArrowDownOutlined />}
              disabled={isDefaultProfile || displayIndex === totalProfiles}
              onClick={onMoveDown}
            />
          </Tooltip>
          <Tooltip title={t('pages.inbounds.form.duplicateProfile')}>
            <Button size="small" type="text" icon={<CopyOutlined />} onClick={onDuplicate} />
          </Tooltip>
          <Tooltip title={t('delete')}>
            <Button
              size="small"
              type="text"
              danger
              disabled={isDefaultProfile}
              icon={<DeleteOutlined />}
              onClick={onRemove}
            />
          </Tooltip>
        </Space>
      </div>

      <Alert
        type="info"
        showIcon
        title={t('pages.inbounds.form.subscriptionProfileInheritance', {
          protocol: protocol.toUpperCase(),
        })}
      />

      {capabilityIssueGroups.length > 0 && (
        <Alert
          type="warning"
          showIcon
          title={t('pages.inbounds.form.profileCapabilityWarningTitle')}
          description={(
            <Space direction="vertical" size={2}>
              <span>{t('pages.inbounds.form.profileCapabilityWarningDescription')}</span>
              {capabilityIssueGroups.map(([format, issues]) => (
                <span key={format}>
                  <strong>{format === 'clash' ? 'Clash / Mihomo' : format.toUpperCase()}</strong>
                  {': '}
                  {issues
                    .map((issue) => t(
                      SUBSCRIPTION_PROFILE_CAPABILITY_TRANSLATION_KEYS[issue.code],
                    ))
                    .join(', ')}
                </span>
              ))}
            </Space>
          )}
        />
      )}

      <div className="ext-proxy-grid ext-proxy-grid--common">
        <Field label={t('pages.inbounds.form.profileName')}>
          <Form.Item name={[fieldName, 'remark']} noStyle>
            <Input placeholder={`${t('pages.inbounds.form.subscriptionProfile')} ${displayIndex}`} />
          </Form.Item>
        </Field>
        <Field label={t('pages.inbounds.address')}>
          <Form.Item name={[fieldName, 'dest']} noStyle>
            <Input placeholder={t('pages.inbounds.address')} />
          </Form.Item>
        </Field>
        <Field label={t('pages.inbounds.port')}>
          <Form.Item name={[fieldName, 'port']} noStyle>
            <InputNumber style={{ width: '100%' }} min={1} max={65535} />
          </Form.Item>
        </Field>
      </div>

      <details className="ext-proxy-section">
        <summary>{t('pages.inbounds.form.profileTransportSettings')}</summary>
        <div className="ext-proxy-section__body">
          <div className="ext-proxy-grid ext-proxy-grid--selectors">
            <Field label={t('pages.inbounds.form.profileTransport')}>
              <Form.Item name={[fieldName, 'network']} noStyle>
                <Select
                  style={{ width: '100%' }}
                  onChange={onNetworkChange}
                  options={protocol === 'hysteria'
                    ? [{
                      value: 'same',
                      label: t('pages.inbounds.form.sameAsInboundValue', {
                        value: parentNetwork.toUpperCase(),
                      }),
                    }]
                    : [
                      {
                        value: 'same',
                        label: t('pages.inbounds.form.sameAsInboundValue', {
                          value: parentNetwork.toUpperCase(),
                        }),
                      },
                      { value: 'tcp', label: 'TCP / RAW' },
                      { value: 'ws', label: 'WebSocket' },
                      { value: 'grpc', label: 'gRPC' },
                      { value: 'httpupgrade', label: 'HTTP Upgrade' },
                      { value: 'xhttp', label: 'XHTTP' },
                      { value: 'kcp', label: 'mKCP' },
                    ]}
                />
              </Form.Item>
            </Field>
          </div>

          {selectedNetwork === 'same' ? (
            <Alert
              type="success"
              showIcon
              title={t('pages.inbounds.form.profileUsesInboundTransport', {
                network: parentNetwork.toUpperCase(),
              })}
            />
          ) : (
            <TransportSettingsFields
              fieldName={fieldName}
              absoluteBase={[...base]}
              network={effectiveNetwork}
              form={form}
            />
          )}

          <div className="ext-proxy-transport-options">
            <div
              className={[
                'ext-proxy-transport-option',
                'ext-proxy-transport-option--final-mask',
                finalMask != null ? 'ext-proxy-transport-option--expanded' : '',
              ].filter(Boolean).join(' ')}
            >
              <div className="ext-proxy-field ext-proxy-transport-toggle">
                <div className="ext-proxy-transport-toggle__copy">
                  <span className="ext-proxy-flabel ext-proxy-transport-toggle__label">
                    {t('pages.inbounds.form.finalMask')}
                  </span>
                  <span className="ext-proxy-fhint ext-proxy-transport-toggle__hint">
                    {t('pages.inbounds.form.profileFinalMaskHint', {
                      defaultValue: 'Configure client-side transport masks.',
                    })}
                  </span>
                </div>
                <div className="ext-proxy-transport-toggle__control">
                  <Switch
                    checked={finalMask != null}
                    onChange={(checked) => {
                      form.setFieldValue(
                        [...base, 'finalmask'],
                        checked
                          ? (effectiveNetwork === 'kcp' ? createMKCPLegacyFinalMask() : {})
                          : undefined,
                      );
                    }}
                  />
                </div>
              </div>
              {finalMask != null && (
                <div className="ext-proxy-transport-option__content">
                  <div className="ext-proxy-profile-finalmask-form">
                    <FinalMaskForm
                      name={[...base, 'finalmask']}
                      network={effectiveNetwork}
                      protocol={protocol}
                      form={form}
                    />
                  </div>
                </div>
              )}
            </div>

            <div
              className={[
                'ext-proxy-transport-option',
                'ext-proxy-transport-option--client-sockopt',
                sockopt != null ? 'ext-proxy-transport-option--expanded' : '',
              ].filter(Boolean).join(' ')}
            >
              <ClientSockoptForm
                variant="profile"
                value={sockopt ? JSON.stringify(sockopt) : ''}
                onChange={(next) => {
                  if (!next) {
                    form.setFieldValue(
                      [...base, 'sockopt'],
                      undefined,
                    );
                    return;
                  }

                  try {
                    form.setFieldValue(
                      [...base, 'sockopt'],
                      JSON.parse(next) as Record<string, unknown>,
                    );
                  } catch {
                    // The isolated adapter emits valid JSON.
                  }
                }}
              />
            </div>

            <div
              className={[
                'ext-proxy-transport-option',
                'ext-proxy-transport-option--listener-sockopt',
                runtime?.sockopt != null
                  ? 'ext-proxy-transport-option--expanded'
                  : '',
              ].filter(Boolean).join(' ')}
            >
              <ProfileRuntimeSockoptFields
                fieldName={fieldName}
                absoluteBase={[...base]}
                network={effectiveNetwork}
                sockopt={runtime?.sockopt}
                form={form}
              />
            </div>
          </div>
        </div>
      </details>

      <details className="ext-proxy-section ext-proxy-section--security">
        <summary>{t('pages.inbounds.form.profileSecuritySettings')}</summary>
        <div className="ext-proxy-section__body ext-proxy-security-shell">
          <div className="ext-proxy-security-mode-row">
            <span className="ext-proxy-flabel ext-proxy-security-label">
              {t('security')}
            </span>
            <div className="ext-proxy-security-control">
              <Form.Item name={[fieldName, 'security']} noStyle>
                <Radio.Group
                  className="ext-proxy-security-mode"
                  buttonStyle="solid"
                  optionType="button"
                  onChange={(event) => onSecurityChange(event.target.value)}
                  options={protocol === 'hysteria'
                    ? [
                      {
                        value: 'same',
                        label: t('pages.inbounds.form.sameAsInboundValue', {
                          value: parentSecurity.toUpperCase(),
                        }),
                      },
                      { value: 'tls', label: 'TLS' },
                    ]
                    : [
                      {
                        value: 'same',
                        label: t('pages.inbounds.form.sameAsInboundValue', {
                          value: parentSecurity.toUpperCase(),
                        }),
                      },
                      { value: 'none', label: t('none') },
                      {
                        value: 'tls',
                        label: 'TLS',
                        disabled: !canEnableTls({
                          protocol,
                          streamSettings: { network: effectiveNetwork },
                        }),
                      },
                      {
                        value: 'reality',
                        label: 'REALITY',
                        disabled: !canEnableReality({
                          protocol,
                          streamSettings: { network: effectiveNetwork },
                        }),
                      },
                    ]}
                />
              </Form.Item>
            </div>
          </div>

          {selectedSecurity === 'same' ? (
            <ProfileSecurityStatus tone="success">
              {t('pages.inbounds.form.profileUsesInboundSecurity', {
                security: parentSecurity.toUpperCase(),
              })}
            </ProfileSecurityStatus>
          ) : (
            <ProfileClientSecurityFields
              fieldName={fieldName}
              absoluteBase={[...base]}
              security={effectiveSecurity}
              form={form}
              actions={securityActions}
            />
          )}

          {effectiveSecurity !== 'none' && (
            <ProfileRuntimeServerSecurityFields
              fieldName={fieldName}
              absoluteBase={[...base]}
              security={effectiveSecurity}
              inheritedSecurity={parentSecurity}
              required={runtimeServerSecurityRequired}
              settings={runtimeSecuritySettings}
              form={form}
              actions={securityActions}
            />
          )}
        </div>
      </details>

      <details className="ext-proxy-section">
        <summary>{t('pages.inbounds.form.profileAdvancedSettings')}</summary>
        <div className="ext-proxy-section__body">
          <Field
            label={t('pages.inbounds.form.profileMuxMode')}
            hint={t('pages.inbounds.form.profileMuxHint')}
          >
            <Select
              value={muxMode}
              onChange={(mode) => {
                if (mode === 'same') {
                  form.setFieldValue([...base, 'mux'], undefined);
                  return;
                }
                if (mode === 'disabled') {
                  form.setFieldValue([...base, 'mux'], { enabled: false });
                  return;
                }
                form.setFieldValue(
                  [...base, 'mux'],
                  SubscriptionProfileMuxSchema.parse({ enabled: true }),
                );
              }}
              options={[
                { value: 'same', label: t('pages.inbounds.form.profileMuxInherit') },
                { value: 'enabled', label: t('pages.inbounds.form.profileMuxEnabled') },
                { value: 'disabled', label: t('pages.inbounds.form.profileMuxDisabled') },
              ]}
            />
          </Field>

          {muxMode === 'enabled' && (
            <div className="ext-proxy-grid ext-proxy-grid--three">
              <Field label={t('pages.xray.outboundForm.concurrency')}>
                <Form.Item name={[fieldName, 'mux', 'concurrency']} noStyle>
                  <InputNumber min={-1} style={{ width: '100%' }} />
                </Form.Item>
              </Field>
              <Field label={t('pages.xray.outboundForm.xudpConcurrency')}>
                <Form.Item name={[fieldName, 'mux', 'xudpConcurrency']} noStyle>
                  <InputNumber min={-1} style={{ width: '100%' }} />
                </Form.Item>
              </Field>
              <Field label={t('pages.inbounds.form.xudpProxyUDP443')}>
                <Form.Item name={[fieldName, 'mux', 'xudpProxyUDP443']} noStyle>
                  <Select
                    options={['reject', 'allow', 'skip'].map((value) => ({ value, label: value }))}
                  />
                </Form.Item>
              </Field>
            </div>
          )}

          <div className="ext-proxy-grid ext-proxy-grid--three">
            <Field
              label={t('pages.hosts.fields.excludeFromSubTypes')}
              hint={t('pages.hosts.hints.excludeFromSubTypes')}
            >
              <Form.Item name={[fieldName, 'excludeFromSubTypes']} noStyle>
                <Select
                  mode="multiple"
                  allowClear
                  options={[
                    { value: 'raw', label: 'Raw' },
                    { value: 'json', label: 'JSON' },
                    { value: 'clash', label: 'Clash / Mihomo' },
                  ]}
                />
              </Form.Item>
            </Field>

            <Field
              label={t('pages.hosts.fields.vlessRoute')}
              hint={t('pages.hosts.hints.vlessRoute')}
            >
              <Form.Item name={[fieldName, 'vlessRoute']} noStyle>
                <Input placeholder="53,443,1000-2000" />
              </Form.Item>
            </Field>

            <Field label={t('pages.hosts.fields.mihomoIpVersion')}>
              <Form.Item name={[fieldName, 'mihomoIpVersion']} noStyle>
                <Select
                  allowClear
                  placeholder="Auto"
                  options={[
                    { value: 'dual', label: 'dual' },
                    { value: 'ipv4', label: 'ipv4' },
                    { value: 'ipv6', label: 'ipv6' },
                    { value: 'ipv4-prefer', label: 'ipv4-prefer' },
                    { value: 'ipv6-prefer', label: 'ipv6-prefer' },
                  ]}
                />
              </Form.Item>
            </Field>
          </div>

          <div className="ext-proxy-grid ext-proxy-grid--two">
            <Field label={t('pages.hosts.fields.mihomoX25519')}>
              <Form.Item name={[fieldName, 'mihomoX25519']} valuePropName="checked" noStyle>
                <Switch />
              </Form.Item>
            </Field>

            <Field label={t('pages.hosts.fields.shuffleHost')}>
              <Form.Item name={[fieldName, 'shuffleHost']} valuePropName="checked" noStyle>
                <Switch />
              </Form.Item>
            </Field>
          </div>
        </div>
      </details>
      </div>
    </>
  );
}

function TransportSettingsFields({
  fieldName,
  absoluteBase,
  network,
  form,
}: {
  fieldName: number;
  absoluteBase: (string | number)[];
  network: string;
  form: FormInstance;
}) {
  const { t } = useTranslation();
  if (
    network === 'tcp'
    || network === 'ws'
    || network === 'grpc'
    || network === 'httpupgrade'
    || network === 'kcp'
  ) {
    return (
      <ProfileSimpleTransportFields
        fieldName={fieldName}
        absoluteBase={absoluteBase}
        network={network}
        form={form}
      />
    );
  }

  if (network === 'xhttp') {
    return (
      <ProfileXhttpTransportFields
        fieldName={fieldName}
        absoluteBase={absoluteBase}
        form={form}
      />
    );
  }

  return <Alert type="warning" showIcon title={t('pages.inbounds.form.unsupportedProfileTransport')} />;
}
