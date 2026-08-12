import { useTranslation } from 'react-i18next';
import {
  Alert,
  Form,
  InputNumber,
  Segmented,
  Select,
  Switch,
  type FormInstance,
} from 'antd';

import CustomSockoptList from '@/lib/xray/forms/transport/CustomSockoptList';
import {
  SOCKOPT_TCP_CONGESTION_OPTIONS,
  SOCKOPT_TPROXY_OPTIONS,
  SOCKOPT_TRUSTED_HEADER_OPTIONS,
  applyRealClientIpPreset,
  createSockoptDefaults,
  deriveRealClientIpPreset,
  sockoptSupportsProxyProtocol,
  sockoptSupportsTrustedHeader,
  transportProxySettingsKey,
  type RealClientIpPreset,
} from '@/lib/xray/forms/transport/sockopt-foundation';
import {
  ProfileTransportField,
  ProfileTransportGrid,
  ProfileTransportSubsection,
  ProfileTransportToggleRow,
} from '@/pages/inbounds/form/transport/subscription-profile-transport-ui';

interface ProfileRuntimeSockoptFieldsProps {
  fieldName: number;
  absoluteBase: (string | number)[];
  network: string;
  sockopt?: Record<string, unknown>;
  form: FormInstance;
}

export default function ProfileRuntimeSockoptFields({
  fieldName,
  absoluteBase,
  network,
  sockopt,
  form,
}: ProfileRuntimeSockoptFieldsProps) {
  const { t } = useTranslation();
  const enabled = sockopt != null;
  const transportSettingsKey = transportProxySettingsKey(network);
  const transportAcceptProxyProtocol =
    Form.useWatch(
      transportSettingsKey
        ? [...absoluteBase, transportSettingsKey, 'acceptProxyProtocol']
        : [...absoluteBase, '__noTransportProxyProtocol'],
      form,
    ) === true;
  const trustedXForwardedFor = Form.useWatch(
    [...absoluteBase, 'runtime', 'sockopt', 'trustedXForwardedFor'],
    form,
  );
  const preset = deriveRealClientIpPreset({
    sockopt,
    transportAcceptProxyProtocol,
  });
  const trustedMismatch =
    Array.isArray(trustedXForwardedFor) &&
    trustedXForwardedFor.length > 0 &&
    !sockoptSupportsTrustedHeader(network);
  const proxyMismatch =
    preset === 'proxy' && !sockoptSupportsProxyProtocol(network);

  const setTransportProxyProtocol = (checked: boolean) => {
    if (!transportSettingsKey) return;
    form.setFieldValue(
      [...absoluteBase, transportSettingsKey, 'acceptProxyProtocol'],
      checked,
    );
  };

  const applyPreset = (nextPreset: RealClientIpPreset) => {
    const result = applyRealClientIpPreset({
      sockopt: form.getFieldValue([...absoluteBase, 'runtime', 'sockopt']),
      preset: nextPreset,
    });
    form.setFieldValue(
      [...absoluteBase, 'runtime', 'sockopt'],
      result.sockopt,
    );
    setTransportProxyProtocol(result.transportAcceptProxyProtocol);
  };

  return (
    <div className="ext-proxy-runtime-sockopt">
      <ProfileTransportToggleRow
        label={t('pages.inbounds.form.profileRuntimeSockopt')}
        hint={t('pages.inbounds.form.profileRuntimeSockoptHint')}
        className="ext-proxy-transport-toggle--listener-sockopt"
        control={(
          <Switch
            checked={enabled}
            onChange={(checked) => {
              form.setFieldValue(
                [...absoluteBase, 'runtime', 'sockopt'],
                checked ? createSockoptDefaults() : undefined,
              );
            }}
          />
        )}
      />

      {enabled && (
        <div className="ext-proxy-transport-option__content ext-proxy-profile-listener-sockopt">
          <ProfileTransportSubsection
            title={t('pages.inbounds.form.realClientIp')}
            className="ext-proxy-transport-subsection--plain"
          >
            <ProfileTransportField
              label={t('pages.inbounds.form.realClientIp')}
              hint={t('pages.inbounds.form.realClientIpHint')}
              wide
            >
              <Segmented
                block
                value={preset}
                onChange={(value) =>
                  applyPreset(value as RealClientIpPreset)
                }
                options={[
                  {
                    value: 'off',
                    label: t('pages.inbounds.form.realClientIpPresetOff'),
                  },
                  {
                    value: 'cloudflare',
                    label: t(
                      'pages.inbounds.form.realClientIpPresetCloudflare',
                    ),
                  },
                  {
                    value: 'proxy',
                    label: t(
                      'pages.inbounds.form.realClientIpPresetProxyProtocol',
                    ),
                  },
                ]}
              />
            </ProfileTransportField>

            {trustedMismatch && (
              <Alert
                type="warning"
                showIcon
                title={t(
                  'pages.inbounds.form.realClientIpTrustedHeaderTransportWarn',
                )}
              />
            )}
            {proxyMismatch && (
              <Alert
                type="warning"
                showIcon
                title={t(
                  'pages.inbounds.form.realClientIpProxyProtocolTransportWarn',
                )}
              />
            )}
          </ProfileTransportSubsection>

          <ProfileTransportSubsection
            title={t('pages.inbounds.form.profileSocketTunables', {
              defaultValue: 'Socket tunables',
            })}
            className="ext-proxy-transport-subsection--plain"
          >
            <ProfileTransportGrid columns={2}>
              <ProfileTransportField
                label={t('pages.inbounds.form.routeMark')}
              >
                <Form.Item
                  name={[fieldName, 'runtime', 'sockopt', 'mark']}
                  noStyle
                >
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </ProfileTransportField>
              <ProfileTransportField
                label={t('pages.inbounds.form.tcpKeepAliveInterval')}
              >
                <Form.Item
                  name={[
                    fieldName,
                    'runtime',
                    'sockopt',
                    'tcpKeepAliveInterval',
                  ]}
                  noStyle
                >
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </ProfileTransportField>
              <ProfileTransportField
                label={t('pages.inbounds.form.tcpKeepAliveIdle')}
              >
                <Form.Item
                  name={[
                    fieldName,
                    'runtime',
                    'sockopt',
                    'tcpKeepAliveIdle',
                  ]}
                  noStyle
                >
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </ProfileTransportField>
              <ProfileTransportField
                label={t('pages.inbounds.form.tcpMaxSeg')}
              >
                <Form.Item
                  name={[fieldName, 'runtime', 'sockopt', 'tcpMaxSeg']}
                  noStyle
                >
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </ProfileTransportField>
              <ProfileTransportField
                label={t('pages.inbounds.form.tcpUserTimeout')}
              >
                <Form.Item
                  name={[
                    fieldName,
                    'runtime',
                    'sockopt',
                    'tcpUserTimeout',
                  ]}
                  noStyle
                >
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </ProfileTransportField>
              <ProfileTransportField
                label={t('pages.inbounds.form.tcpWindowClamp')}
                hint={t('pages.inbounds.form.tcpWindowClampHint')}
              >
                <Form.Item
                  name={[
                    fieldName,
                    'runtime',
                    'sockopt',
                    'tcpWindowClamp',
                  ]}
                  noStyle
                >
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </ProfileTransportField>
              <ProfileTransportField
                label={t('pages.inbounds.form.tcpCongestion')}
              >
                <Form.Item
                  name={[fieldName, 'runtime', 'sockopt', 'tcpcongestion']}
                  noStyle
                >
                  <Select
                    options={SOCKOPT_TCP_CONGESTION_OPTIONS.map((value) => ({
                      value,
                      label: value,
                    }))}
                  />
                </Form.Item>
              </ProfileTransportField>
              <ProfileTransportField label="TProxy">
                <Form.Item
                  name={[fieldName, 'runtime', 'sockopt', 'tproxy']}
                  noStyle
                >
                  <Select
                    options={SOCKOPT_TPROXY_OPTIONS.map(({ value, label }) => ({
                      value,
                      label,
                    }))}
                  />
                </Form.Item>
              </ProfileTransportField>
            </ProfileTransportGrid>
          </ProfileTransportSubsection>

          <ProfileTransportSubsection
            title={t('pages.inbounds.form.profileSocketFlags', {
              defaultValue: 'Listener flags',
            })}
            className="ext-proxy-transport-subsection--plain"
          >
            <ProfileTransportGrid columns={1}>
              <ProfileTransportToggleRow
                label={t('pages.inbounds.form.proxyProtocol')}
                control={(
                  <Form.Item
                    name={[
                      fieldName,
                      'runtime',
                      'sockopt',
                      'acceptProxyProtocol',
                    ]}
                    valuePropName="checked"
                    noStyle
                  >
                    <Switch onChange={setTransportProxyProtocol} />
                  </Form.Item>
                )}
              />
              <ProfileTransportToggleRow
                label={t('pages.inbounds.form.tcpFastOpen')}
                control={(
                  <Form.Item
                    name={[
                      fieldName,
                      'runtime',
                      'sockopt',
                      'tcpFastOpen',
                    ]}
                    valuePropName="checked"
                    noStyle
                  >
                    <Switch />
                  </Form.Item>
                )}
              />
              <ProfileTransportToggleRow
                label={t('pages.inbounds.form.penetrate')}
                control={(
                  <Form.Item
                    name={[
                      fieldName,
                      'runtime',
                      'sockopt',
                      'penetrate',
                    ]}
                    valuePropName="checked"
                    noStyle
                  >
                    <Switch />
                  </Form.Item>
                )}
              />
              <ProfileTransportToggleRow
                label={t('pages.inbounds.form.v6Only')}
                control={(
                  <Form.Item
                    name={[fieldName, 'runtime', 'sockopt', 'V6Only']}
                    valuePropName="checked"
                    noStyle
                  >
                    <Switch />
                  </Form.Item>
                )}
              />
            </ProfileTransportGrid>
          </ProfileTransportSubsection>

          <ProfileTransportSubsection
            title={t('pages.inbounds.form.trustedXForwardedFor')}
            className="ext-proxy-transport-subsection--plain"
          >
            <ProfileTransportField
              label={t('pages.inbounds.form.trustedXForwardedFor')}
              hint={t('pages.inbounds.form.trustedXForwardedForHint')}
              wide
            >
              <Form.Item
                name={[
                  fieldName,
                  'runtime',
                  'sockopt',
                  'trustedXForwardedFor',
                ]}
                noStyle
              >
                <Select
                  mode="tags"
                  tokenSeparators={[',']}
                  options={SOCKOPT_TRUSTED_HEADER_OPTIONS.map((value) => ({
                    value,
                    label: value,
                  }))}
                />
              </Form.Item>
            </ProfileTransportField>
          </ProfileTransportSubsection>

          <div className="ext-proxy-profile-custom-sockopt">
            <CustomSockoptList
              name={[fieldName, 'runtime', 'sockopt', 'customSockopt']}
            />
          </div>
        </div>
      )}
    </div>
  );
}
