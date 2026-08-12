import { useTranslation } from 'react-i18next';
import { Alert, Form, InputNumber, Segmented, Select, Switch } from 'antd';
import { Controller, useFormContext, useWatch } from 'react-hook-form';

import { FormField } from '@/components/form/rhf';
import { SockoptCustomField } from '@/lib/xray/forms/fields';
import {
  SOCKOPT_TCP_CONGESTION_OPTIONS,
  SOCKOPT_TPROXY_OPTIONS,
  SOCKOPT_TRUSTED_HEADER_OPTIONS,
  applyRealClientIpPreset,
  deriveRealClientIpPreset,
  transportProxySettingsKey,
  sockoptSupportsProxyProtocol,
  sockoptSupportsTrustedHeader,
  type RealClientIpPreset,
} from '@/lib/xray/forms/transport/sockopt-foundation';

export default function SockoptForm({
  toggleSockopt,
  network,
}: {
  toggleSockopt: (on: boolean) => void;
  network: string;
}) {
  const { t } = useTranslation();
  const { control, getValues, setValue } = useFormContext();
  const sock = useWatch({ control, name: 'streamSettings.sockopt' });
  const on = !!sock && typeof sock === 'object' && Object.keys(sock).length > 0;

  const transportField = transportProxySettingsKey(network);
  const sockAcceptPP = useWatch({ control, name: 'streamSettings.sockopt.acceptProxyProtocol' });
  const sockTrusted = useWatch({ control, name: 'streamSettings.sockopt.trustedXForwardedFor' });
  const transportAcceptPP = useWatch({
    control,
    name: transportField ? `streamSettings.${transportField}.acceptProxyProtocol` : 'streamSettings.__noTransportProxyField',
  });

  const applyPreset = (preset: RealClientIpPreset) => {
    const current = getValues('streamSettings.sockopt');
    const sockoptOn =
      !!current && typeof current === 'object' && Object.keys(current as object).length > 0;
    if (preset !== 'off' && !sockoptOn) toggleSockopt(true);

    const result = applyRealClientIpPreset({ sockopt: current, preset });
    setValue(
      'streamSettings.sockopt.trustedXForwardedFor',
      result.sockopt.trustedXForwardedFor,
    );
    setValue(
      'streamSettings.sockopt.acceptProxyProtocol',
      result.sockopt.acceptProxyProtocol,
    );
    if (transportField) {
      setValue(
        `streamSettings.${transportField}.acceptProxyProtocol`,
        result.transportAcceptProxyProtocol,
      );
    }
  };

  const transportPP = transportField ? transportAcceptPP === true : false;
  const trusted = Array.isArray(sockTrusted) ? (sockTrusted as string[]) : [];
  const presetValue = deriveRealClientIpPreset({
    sockopt: {
      acceptProxyProtocol: sockAcceptPP,
      trustedXForwardedFor: trusted,
    },
    transportAcceptProxyProtocol: transportPP,
  });
  const trustedMismatch = trusted.length > 0 && !sockoptSupportsTrustedHeader(network);
  const proxyMismatch = presetValue === 'proxy' && !sockoptSupportsProxyProtocol(network);

  return (
    <>
      <Form.Item label="Sockopt">
        <Switch checked={on} onChange={toggleSockopt} aria-label="Sockopt" />
      </Form.Item>
      {on && (
        <>
          <Form.Item
            label={t('pages.inbounds.form.realClientIp')}
            tooltip={t('pages.inbounds.form.realClientIpHint')}
          >
            <Segmented
              value={presetValue}
              onChange={(v) => applyPreset(v as RealClientIpPreset)}
              options={[
                { value: 'off', label: t('pages.inbounds.form.realClientIpPresetOff') },
                { value: 'cloudflare', label: t('pages.inbounds.form.realClientIpPresetCloudflare') },
                { value: 'proxy', label: t('pages.inbounds.form.realClientIpPresetProxyProtocol') },
              ]}
            />
          </Form.Item>
          {trustedMismatch && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              title={t('pages.inbounds.form.realClientIpTrustedHeaderTransportWarn')}
            />
          )}
          {proxyMismatch && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              title={t('pages.inbounds.form.realClientIpProxyProtocolTransportWarn')}
            />
          )}
          <FormField name={['streamSettings', 'sockopt', 'mark']} label={t('pages.inbounds.form.routeMark')}>
            <InputNumber min={0} />
          </FormField>
          <FormField
            name={['streamSettings', 'sockopt', 'tcpKeepAliveInterval']}
            label={t('pages.inbounds.form.tcpKeepAliveInterval')}
          >
            <InputNumber min={0} />
          </FormField>
          <FormField
            name={['streamSettings', 'sockopt', 'tcpKeepAliveIdle']}
            label={t('pages.inbounds.form.tcpKeepAliveIdle')}
          >
            <InputNumber min={0} />
          </FormField>
          <FormField name={['streamSettings', 'sockopt', 'tcpMaxSeg']} label={t('pages.inbounds.form.tcpMaxSeg')}>
            <InputNumber min={0} />
          </FormField>
          <FormField
            name={['streamSettings', 'sockopt', 'tcpUserTimeout']}
            label={t('pages.inbounds.form.tcpUserTimeout')}
          >
            <InputNumber min={0} />
          </FormField>
          <FormField
            name={['streamSettings', 'sockopt', 'tcpWindowClamp']}
            label={t('pages.inbounds.form.tcpWindowClamp')}
            tooltip={t('pages.inbounds.form.tcpWindowClampHint')}
          >
            <InputNumber min={0} />
          </FormField>
          <FormField
            name={['streamSettings', 'sockopt', 'acceptProxyProtocol']}
            label={t('pages.inbounds.form.proxyProtocol')}
            tooltip={t('pages.inbounds.form.proxyProtocolHint')}
            valueProp="checked"
          >
            <Switch
              onChange={(checked) => {
                if (!transportField) return;
                setValue(
                  `streamSettings.${transportField}.acceptProxyProtocol`,
                  checked,
                );
              }}
            />
          </FormField>
          <FormField
            name={['streamSettings', 'sockopt', 'tcpFastOpen']}
            label={t('pages.inbounds.form.tcpFastOpen')}
            valueProp="checked"
          >
            <Switch />
          </FormField>
          <FormField
            name={['streamSettings', 'sockopt', 'penetrate']}
            label={t('pages.inbounds.form.penetrate')}
            valueProp="checked"
          >
            <Switch />
          </FormField>
          <FormField
            name={['streamSettings', 'sockopt', 'V6Only']}
            label={t('pages.inbounds.form.v6Only')}
            valueProp="checked"
          >
            <Switch />
          </FormField>
          <FormField
            name={['streamSettings', 'sockopt', 'tcpcongestion']}
            label={t('pages.inbounds.form.tcpCongestion')}
          >
            <Select
              style={{ width: '50%' }}
              options={SOCKOPT_TCP_CONGESTION_OPTIONS.map((value) => ({
                value,
                label: value,
              }))}
            />
          </FormField>
          <FormField name={['streamSettings', 'sockopt', 'tproxy']} label="TProxy">
            <Select
              style={{ width: '50%' }}
              options={SOCKOPT_TPROXY_OPTIONS.map(({ value, label }) => ({
                  value,
                  label,
                }))}
            />
          </FormField>
          <FormField
            name={['streamSettings', 'sockopt', 'trustedXForwardedFor']}
            label={t('pages.inbounds.form.trustedXForwardedFor')}
            tooltip={t('pages.inbounds.form.trustedXForwardedForHint')}
          >
            <Select
              mode="tags"
              style={{ width: '100%' }}
              tokenSeparators={[',']}
              options={SOCKOPT_TRUSTED_HEADER_OPTIONS.map((value) => ({
                value,
                label: value,
              }))}
            />
          </FormField>
          <Controller
            control={control}
            name="streamSettings.sockopt.customSockopt"
            render={({ field }) => (
              <SockoptCustomField value={field.value} onChange={field.onChange} />
            )}
          />
        </>
      )}
    </>
  );
}
