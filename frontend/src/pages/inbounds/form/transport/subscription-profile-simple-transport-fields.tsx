import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  type FormInstance,
} from 'antd';

import { HeaderMapEditor } from '@/components/form';
import { createTcpHeaderForCamouflage } from '@/lib/xray/forms/transport/transport-foundation';
import {
  ProfileTransportBlock,
  ProfileTransportField,
  ProfileTransportGrid,
  ProfileTransportSubsection,
  ProfileTransportToggleRow,
} from '@/pages/inbounds/form/transport/subscription-profile-transport-ui';

interface ProfileFieldProps {
  label: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
}

export function ProfileField({ label, children, hint }: ProfileFieldProps) {
  return (
    <div className="ext-proxy-field">
      <span className="ext-proxy-flabel">{label}</span>
      {children}
      {hint && <span className="ext-proxy-fhint">{hint}</span>}
    </div>
  );
}

type SimpleProfileNetwork =
  | 'tcp'
  | 'ws'
  | 'grpc'
  | 'httpupgrade'
  | 'kcp';

interface ProfileSimpleTransportFieldsProps {
  fieldName: number;
  absoluteBase: (string | number)[];
  network: SimpleProfileNetwork;
  form: FormInstance;
}

function ProxyProtocolToggle({
  fieldName,
  absoluteBase,
  settingsKey,
  form,
}: {
  fieldName: number;
  absoluteBase: (string | number)[];
  settingsKey: 'tcpSettings' | 'wsSettings' | 'httpupgradeSettings';
  form: FormInstance;
}) {
  const { t } = useTranslation();

  return (
    <ProfileTransportToggleRow
      label={t('pages.inbounds.form.proxyProtocol')}
      hint={t('pages.inbounds.form.profileProxyProtocolHint', {
        defaultValue: 'Accept PROXY protocol metadata on this transport.',
      })}
      control={(
        <Form.Item
          name={[fieldName, settingsKey, 'acceptProxyProtocol']}
          valuePropName="checked"
          noStyle
        >
          <Switch
            onChange={(checked) => {
              const runtimeSockopt = form.getFieldValue([
                ...absoluteBase,
                'runtime',
                'sockopt',
              ]);
              if (runtimeSockopt == null) return;
              form.setFieldValue(
                [...absoluteBase, 'runtime', 'sockopt', 'acceptProxyProtocol'],
                checked,
              );
            }}
          />
        </Form.Item>
      )}
    />
  );
}

function TcpProfileTransportFields({
  fieldName,
  absoluteBase,
  form,
}: Omit<ProfileSimpleTransportFieldsProps, 'network'>) {
  const { t } = useTranslation();
  const headerType = Form.useWatch(
    [...absoluteBase, 'tcpSettings', 'header', 'type'],
    { form, preserve: true },
  ) as string | undefined;
  const camouflageEnabled = headerType === 'http';

  return (
    <div className="ext-proxy-transport-shell" data-transport="tcp">
      <ProfileTransportBlock
        className={[
          'ext-proxy-transport-block--connection',
          camouflageEnabled
            ? 'ext-proxy-transport-block--camouflage-expanded'
            : '',
        ].filter(Boolean).join(' ')}
      >
        <ProfileTransportGrid columns={1}>
          <ProxyProtocolToggle
            fieldName={fieldName}
            absoluteBase={absoluteBase}
            settingsKey="tcpSettings"
            form={form}
          />
          <ProfileTransportToggleRow
            label={`HTTP ${t('camouflage')}`}
            hint={t('pages.inbounds.form.profileHttpObfuscationHint', {
              defaultValue: 'Customize fake HTTP request and response metadata.',
            })}
            control={(
              <Switch
                checked={camouflageEnabled}
                onChange={(checked) => {
                  form.setFieldValue(
                    [...absoluteBase, 'tcpSettings', 'header'],
                    createTcpHeaderForCamouflage(checked),
                  );
                }}
              />
            )}
          />
        </ProfileTransportGrid>

        {camouflageEnabled && (
          <div
            className="ext-proxy-transport-camouflage"
            data-testid="tcp-http-obfuscation-panel"
          >
            <div className="ext-proxy-transport-request-response ext-proxy-transport-request-response--stacked">
              <ProfileTransportSubsection
                title={t('request', { defaultValue: 'Request' })}
                className="ext-proxy-transport-subsection--camouflage"
              >
                <ProfileTransportGrid
                  columns={1}
                  className="ext-proxy-transport-grid--http-request"
                >
                  <ProfileTransportField
                    label={t('pages.inbounds.form.requestVersion')}
                  >
                    <Form.Item
                      name={[
                        fieldName,
                        'tcpSettings',
                        'header',
                        'request',
                        'version',
                      ]}
                      noStyle
                    >
                      <Input placeholder="1.1" />
                    </Form.Item>
                  </ProfileTransportField>
                  <ProfileTransportField
                    label={t('pages.inbounds.form.requestMethod')}
                  >
                    <Form.Item
                      name={[
                        fieldName,
                        'tcpSettings',
                        'header',
                        'request',
                        'method',
                      ]}
                      noStyle
                    >
                      <Input placeholder="GET" />
                    </Form.Item>
                  </ProfileTransportField>
                  <ProfileTransportField
                    label={t('pages.inbounds.form.requestPath')}
                  >
                    <Form.Item
                      name={[
                        fieldName,
                        'tcpSettings',
                        'header',
                        'request',
                        'path',
                      ]}
                      noStyle
                    >
                      <Select
                        mode="tags"
                        tokenSeparators={[',']}
                        placeholder="/"
                      />
                    </Form.Item>
                  </ProfileTransportField>
                </ProfileTransportGrid>

                <Form.Item
                  name={[
                    fieldName,
                    'tcpSettings',
                    'header',
                    'request',
                    'headers',
                  ]}
                  noStyle
                >
                  <HeaderMapEditor
                    mode="v2"
                    variant="profile"
                    label={t('pages.inbounds.form.requestHeaders')}
                  />
                </Form.Item>
              </ProfileTransportSubsection>

              <ProfileTransportSubsection
                title={t('response', { defaultValue: 'Response' })}
                className="ext-proxy-transport-subsection--camouflage"
              >
                <ProfileTransportGrid
                  columns={1}
                  className="ext-proxy-transport-grid--http-response"
                >
                  <ProfileTransportField
                    label={t('pages.inbounds.form.responseVersion')}
                  >
                    <Form.Item
                      name={[
                        fieldName,
                        'tcpSettings',
                        'header',
                        'response',
                        'version',
                      ]}
                      noStyle
                    >
                      <Input placeholder="1.1" />
                    </Form.Item>
                  </ProfileTransportField>
                  <ProfileTransportField
                    label={t('pages.inbounds.form.responseStatus')}
                  >
                    <Form.Item
                      name={[
                        fieldName,
                        'tcpSettings',
                        'header',
                        'response',
                        'status',
                      ]}
                      noStyle
                    >
                      <Input placeholder="200" />
                    </Form.Item>
                  </ProfileTransportField>
                  <ProfileTransportField
                    label={t('pages.inbounds.form.responseReason')}
                  >
                    <Form.Item
                      name={[
                        fieldName,
                        'tcpSettings',
                        'header',
                        'response',
                        'reason',
                      ]}
                      noStyle
                    >
                      <Input placeholder="OK" />
                    </Form.Item>
                  </ProfileTransportField>
                </ProfileTransportGrid>

                <Form.Item
                  name={[
                    fieldName,
                    'tcpSettings',
                    'header',
                    'response',
                    'headers',
                  ]}
                  noStyle
                >
                  <HeaderMapEditor
                    mode="v2"
                    variant="profile"
                    label={t('pages.inbounds.form.responseHeaders')}
                  />
                </Form.Item>
              </ProfileTransportSubsection>
            </div>
          </div>
        )}
      </ProfileTransportBlock>
    </div>
  );
}

function WsProfileTransportFields({
  fieldName,
  absoluteBase,
  form,
}: Omit<ProfileSimpleTransportFieldsProps, 'network'>) {
  const { t } = useTranslation();

  return (
    <div className="ext-proxy-transport-shell" data-transport="ws">
      <ProfileTransportBlock
        title={t('pages.inbounds.form.profileTransportConnection', {
          defaultValue: 'Connection',
        })}
        description={t('pages.inbounds.form.profileWebSocketConnectionHint', {
          defaultValue: 'Configure the WebSocket endpoint and heartbeat.',
        })}
      >
        <ProfileTransportGrid columns={2}>
          <ProfileTransportField label={t('host')}>
            <Form.Item name={[fieldName, 'wsSettings', 'host']} noStyle>
              <Input />
            </Form.Item>
          </ProfileTransportField>
          <ProfileTransportField label={t('path')}>
            <Form.Item name={[fieldName, 'wsSettings', 'path']} noStyle>
              <Input />
            </Form.Item>
          </ProfileTransportField>
          <ProfileTransportField
            label={t('pages.inbounds.form.heartbeatPeriod')}
            wide
          >
            <Form.Item
              name={[fieldName, 'wsSettings', 'heartbeatPeriod']}
              noStyle
            >
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </ProfileTransportField>
        </ProfileTransportGrid>
        <ProxyProtocolToggle
          fieldName={fieldName}
          absoluteBase={absoluteBase}
          settingsKey="wsSettings"
          form={form}
        />
        <div className="ext-proxy-transport-inline-headers">
          <Form.Item name={[fieldName, 'wsSettings', 'headers']} noStyle>
            <HeaderMapEditor
              mode="v1"
              variant="profile"
              label={t('pages.inbounds.form.requestHeaders')}
            />
          </Form.Item>
        </div>
      </ProfileTransportBlock>
    </div>
  );
}

function GrpcProfileTransportFields({
  fieldName,
}: Pick<ProfileSimpleTransportFieldsProps, 'fieldName'>) {
  const { t } = useTranslation();

  return (
    <div className="ext-proxy-transport-shell" data-transport="grpc">
      <ProfileTransportBlock
        title={t('pages.inbounds.form.profileTransportConnection', {
          defaultValue: 'Connection',
        })}
        description={t('pages.inbounds.form.profileGrpcConnectionHint', {
          defaultValue: 'Configure the service route and optional authority.',
        })}
      >
        <ProfileTransportGrid columns={2}>
          <ProfileTransportField
            label={t('pages.inbounds.form.serviceName')}
          >
            <Form.Item
              name={[fieldName, 'grpcSettings', 'serviceName']}
              noStyle
            >
              <Input />
            </Form.Item>
          </ProfileTransportField>
          <ProfileTransportField label={t('pages.inbounds.form.authority')}>
            <Form.Item
              name={[fieldName, 'grpcSettings', 'authority']}
              noStyle
            >
              <Input />
            </Form.Item>
          </ProfileTransportField>
        </ProfileTransportGrid>
        <ProfileTransportToggleRow
          label={t('pages.inbounds.form.multiMode')}
          hint={t('pages.inbounds.form.profileGrpcMultiModeHint', {
            defaultValue: 'Use multiple gRPC connections instead of one stream.',
          })}
          control={(
            <Form.Item
              name={[fieldName, 'grpcSettings', 'multiMode']}
              valuePropName="checked"
              noStyle
            >
              <Switch />
            </Form.Item>
          )}
        />
      </ProfileTransportBlock>
    </div>
  );
}

function HttpUpgradeProfileTransportFields({
  fieldName,
  absoluteBase,
  form,
}: Omit<ProfileSimpleTransportFieldsProps, 'network'>) {
  const { t } = useTranslation();

  return (
    <div className="ext-proxy-transport-shell" data-transport="httpupgrade">
      <ProfileTransportBlock
        title={t('pages.inbounds.form.profileTransportConnection', {
          defaultValue: 'Connection',
        })}
        description={t('pages.inbounds.form.profileHttpUpgradeConnectionHint', {
          defaultValue: 'Configure the HTTP Upgrade host and path.',
        })}
      >
        <ProfileTransportGrid columns={2}>
          <ProfileTransportField label={t('host')}>
            <Form.Item
              name={[fieldName, 'httpupgradeSettings', 'host']}
              noStyle
            >
              <Input />
            </Form.Item>
          </ProfileTransportField>
          <ProfileTransportField label={t('path')}>
            <Form.Item
              name={[fieldName, 'httpupgradeSettings', 'path']}
              noStyle
            >
              <Input />
            </Form.Item>
          </ProfileTransportField>
        </ProfileTransportGrid>
        <ProxyProtocolToggle
          fieldName={fieldName}
          absoluteBase={absoluteBase}
          settingsKey="httpupgradeSettings"
          form={form}
        />
        <div className="ext-proxy-transport-inline-headers">
          <Form.Item
            name={[fieldName, 'httpupgradeSettings', 'headers']}
            noStyle
          >
            <HeaderMapEditor
              mode="v1"
              variant="profile"
              label={t('pages.inbounds.form.requestHeaders')}
            />
          </Form.Item>
        </div>
      </ProfileTransportBlock>
    </div>
  );
}

function KcpProfileTransportFields({
  fieldName,
}: Pick<ProfileSimpleTransportFieldsProps, 'fieldName'>) {
  const { t } = useTranslation();

  return (
    <div className="ext-proxy-transport-shell" data-transport="kcp">
      <ProfileTransportBlock
        title={t('pages.inbounds.form.profileKcpPacketSettings', {
          defaultValue: 'Packet and timing',
        })}
        description={t('pages.inbounds.form.profileKcpPacketSettingsHint', {
          defaultValue: 'Tune packet size, timing and available bandwidth.',
        })}
      >
        <ProfileTransportGrid columns={2}>
          <ProfileTransportField label="MTU">
            <Form.Item name={[fieldName, 'kcpSettings', 'mtu']} noStyle>
              <InputNumber min={576} max={1460} style={{ width: '100%' }} />
            </Form.Item>
          </ProfileTransportField>
          <ProfileTransportField label={t('pages.inbounds.form.ttiMs')}>
            <Form.Item name={[fieldName, 'kcpSettings', 'tti']} noStyle>
              <InputNumber min={10} max={100} style={{ width: '100%' }} />
            </Form.Item>
          </ProfileTransportField>
          <ProfileTransportField label={t('pages.inbounds.form.uplinkMbps')}>
            <Form.Item
              name={[fieldName, 'kcpSettings', 'uplinkCapacity']}
              noStyle
            >
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </ProfileTransportField>
          <ProfileTransportField
            label={t('pages.inbounds.form.downlinkMbps')}
          >
            <Form.Item
              name={[fieldName, 'kcpSettings', 'downlinkCapacity']}
              noStyle
            >
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </ProfileTransportField>
        </ProfileTransportGrid>
      </ProfileTransportBlock>

      <ProfileTransportBlock
        title={t('pages.inbounds.form.profileKcpWindowSettings', {
          defaultValue: 'Congestion window',
        })}
        description={t('pages.inbounds.form.profileKcpWindowSettingsHint', {
          defaultValue: 'Control congestion scaling and the send window limit.',
        })}
      >
        <ProfileTransportGrid columns={2}>
          <ProfileTransportField
            label={t('pages.inbounds.form.cwndMultiplier')}
          >
            <Form.Item
              name={[fieldName, 'kcpSettings', 'cwndMultiplier']}
              noStyle
            >
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
          </ProfileTransportField>
          <ProfileTransportField
            label={t('pages.inbounds.form.maxSendingWindow')}
          >
            <Form.Item
              name={[fieldName, 'kcpSettings', 'maxSendingWindow']}
              noStyle
            >
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </ProfileTransportField>
        </ProfileTransportGrid>
      </ProfileTransportBlock>
    </div>
  );
}

export default function ProfileSimpleTransportFields({
  fieldName,
  absoluteBase,
  network,
  form,
}: ProfileSimpleTransportFieldsProps) {
  switch (network) {
    case 'tcp':
      return (
        <TcpProfileTransportFields
          fieldName={fieldName}
          absoluteBase={absoluteBase}
          form={form}
        />
      );
    case 'ws':
      return (
        <WsProfileTransportFields
          fieldName={fieldName}
          absoluteBase={absoluteBase}
          form={form}
        />
      );
    case 'grpc':
      return <GrpcProfileTransportFields fieldName={fieldName} />;
    case 'httpupgrade':
      return (
        <HttpUpgradeProfileTransportFields
          fieldName={fieldName}
          absoluteBase={absoluteBase}
          form={form}
        />
      );
    case 'kcp':
      return <KcpProfileTransportFields fieldName={fieldName} />;
    default:
      return null;
  }
}
