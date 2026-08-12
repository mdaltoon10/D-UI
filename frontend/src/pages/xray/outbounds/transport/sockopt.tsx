import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Form, Input, InputNumber, Select, Switch } from 'antd';
import { Controller, useFormContext, useWatch } from 'react-hook-form';

import { FormField } from '@/components/form/rhf';
import { SockoptCustomField } from '@/lib/xray/forms/fields';
import { DOMAIN_STRATEGY_OPTION, TCP_CONGESTION_OPTION } from '@/schemas/primitives';
import { HappyEyeballsSchema, SockoptStreamSettingsSchema } from '@/schemas/protocols/stream/sockopt';

import { ADDRESS_PORT_STRATEGY_OPTIONS } from '../outbound-form-constants';

function SockoptFieldsContainer({
  variant,
  children,
}: {
  variant: 'default' | 'profile';
  children: ReactNode;
}) {
  if (variant === 'profile') {
    return (
      <div className="ext-proxy-transport-option__content ext-proxy-profile-client-sockopt">
        {children}
      </div>
    );
  }
  return <>{children}</>;
}

export default function SockoptForm({
  outboundTags = [],
  variant = 'default',
}: {
  outboundTags?: string[];
  variant?: 'default' | 'profile';
}) {
  const { t } = useTranslation();
  const { control, setValue } = useFormContext();
  const sockopt = useWatch({ control, name: 'streamSettings.sockopt' });
  const hasSockopt = !!sockopt;
  const dialerProxy = (useWatch({ control, name: 'streamSettings.sockopt.dialerProxy' }) ?? '') as string;
  const happyEyeballs = useWatch({ control, name: 'streamSettings.sockopt.happyEyeballs' });
  const hasHe = happyEyeballs != null;
  const dialerProxyOptions = Array.from(
    new Set([...outboundTags, dialerProxy].filter(Boolean)),
  ).map((tg) => ({ value: tg, label: tg }));
  const toggle = (
    <Switch
      checked={hasSockopt}
      onChange={(checked) => {
        setValue(
          'streamSettings.sockopt',
          checked ? SockoptStreamSettingsSchema.parse({}) : undefined,
        );
      }}
    />
  );

  return (
    <>
      {variant === 'profile' ? (
        <div className="ext-proxy-field ext-proxy-transport-toggle ext-proxy-transport-toggle--client-sockopt">
          <div className="ext-proxy-transport-toggle__copy">
            <span className="ext-proxy-flabel ext-proxy-transport-toggle__label">
              {t('pages.inbounds.form.profileClientSockopt', {
                defaultValue: 'Client socket options',
              })}
            </span>
            <span className="ext-proxy-fhint ext-proxy-transport-toggle__hint">
              {t('pages.inbounds.form.profileClientSockoptHint', {
                defaultValue: 'Configure outbound socket behavior.',
              })}
            </span>
          </div>
          <div className="ext-proxy-transport-toggle__control">{toggle}</div>
        </div>
      ) : (
        <Form.Item label={t('pages.xray.outboundForm.sockopts')}>
          {toggle}
        </Form.Item>
      )}
      {hasSockopt && (
        <SockoptFieldsContainer variant={variant}>
          <FormField
            label={t('pages.inbounds.form.dialerProxy')}
            name={['streamSettings', 'sockopt', 'dialerProxy']}
            tooltip={t('pages.xray.outboundForm.dialerProxyHint')}
          >
            <Select
              allowClear
              showSearch
              placeholder={t('pages.xray.outboundForm.dialerProxyPlaceholder')}
              options={dialerProxyOptions}
            />
          </FormField>
          <FormField
            label={t('pages.xray.wireguard.domainStrategy')}
            name={['streamSettings', 'sockopt', 'domainStrategy']}
          >
            <Select
              options={Object.values(DOMAIN_STRATEGY_OPTION).map((v) => ({
                value: v,
                label: v,
              }))}
            />
          </FormField>
          <FormField
            label={t('pages.inbounds.form.addressPortStrategy')}
            name={['streamSettings', 'sockopt', 'addressPortStrategy']}
          >
            <Select options={ADDRESS_PORT_STRATEGY_OPTIONS} />
          </FormField>
          <FormField
            label={t('pages.xray.outboundForm.keepAliveInterval')}
            name={['streamSettings', 'sockopt', 'tcpKeepAliveInterval']}
          >
            <InputNumber min={0} />
          </FormField>
          <FormField
            label={t('pages.inbounds.form.tcpFastOpen')}
            name={['streamSettings', 'sockopt', 'tcpFastOpen']}
            valueProp="checked"
          >
            <Switch />
          </FormField>
          <FormField
            label={t('pages.inbounds.form.multipathTcp')}
            name={['streamSettings', 'sockopt', 'tcpMptcp']}
            valueProp="checked"
          >
            <Switch />
          </FormField>
          <FormField
            label={t('pages.inbounds.form.penetrate')}
            name={['streamSettings', 'sockopt', 'penetrate']}
            valueProp="checked"
          >
            <Switch />
          </FormField>
          <FormField
            label={t('pages.xray.outboundForm.markFwmark')}
            name={['streamSettings', 'sockopt', 'mark']}
          >
            <InputNumber min={0} />
          </FormField>
          <FormField
            label={t('pages.xray.outboundForm.interface')}
            name={['streamSettings', 'sockopt', 'interface']}
          >
            <Input />
          </FormField>
          <FormField
            label="TProxy"
            name={['streamSettings', 'sockopt', 'tproxy']}
          >
            <Select
              options={[
                { value: 'off', label: 'off' },
                { value: 'redirect', label: 'redirect' },
                { value: 'tproxy', label: 'tproxy' },
              ]}
            />
          </FormField>
          <FormField
            label={t('pages.inbounds.form.tcpCongestion')}
            name={['streamSettings', 'sockopt', 'tcpcongestion']}
          >
            <Select
              options={Object.values(TCP_CONGESTION_OPTION).map((v) => ({
                value: v,
                label: v,
              }))}
            />
          </FormField>
          <FormField
            label={t('pages.xray.outboundForm.tcpUserTimeoutMs')}
            name={['streamSettings', 'sockopt', 'tcpUserTimeout']}
          >
            <InputNumber min={0} />
          </FormField>
          <FormField
            label={t('pages.xray.outboundForm.tcpKeepAliveIdleS')}
            name={['streamSettings', 'sockopt', 'tcpKeepAliveIdle']}
          >
            <InputNumber min={0} />
          </FormField>
          <FormField
            label={t('pages.inbounds.form.tcpMaxSeg')}
            name={['streamSettings', 'sockopt', 'tcpMaxSeg']}
          >
            <InputNumber min={0} />
          </FormField>
          <FormField
            label={t('pages.inbounds.form.tcpWindowClamp')}
            name={['streamSettings', 'sockopt', 'tcpWindowClamp']}
            tooltip={t('pages.inbounds.form.tcpWindowClampHint')}
          >
            <InputNumber min={0} />
          </FormField>
          <Form.Item label="Happy Eyeballs">
            <Switch
              checked={hasHe}
              onChange={(v) => {
                setValue(
                  'streamSettings.sockopt.happyEyeballs',
                  v ? HappyEyeballsSchema.parse({}) : undefined,
                );
              }}
            />
          </Form.Item>
          {hasHe && (
            <>
              <FormField
                label={t('pages.inbounds.form.tryDelayMs')}
                name={['streamSettings', 'sockopt', 'happyEyeballs', 'tryDelayMs']}
              >
                <InputNumber min={0} placeholder="0 (disabled) — 250 recommended" />
              </FormField>
              <FormField
                label={t('pages.inbounds.form.prioritizeIPv6')}
                name={['streamSettings', 'sockopt', 'happyEyeballs', 'prioritizeIPv6']}
                valueProp="checked"
              >
                <Switch />
              </FormField>
              <FormField
                label={t('pages.inbounds.form.interleave')}
                name={['streamSettings', 'sockopt', 'happyEyeballs', 'interleave']}
              >
                <InputNumber min={1} />
              </FormField>
              <FormField
                label={t('pages.inbounds.form.maxConcurrentTry')}
                name={['streamSettings', 'sockopt', 'happyEyeballs', 'maxConcurrentTry']}
              >
                <InputNumber min={0} />
              </FormField>
            </>
          )}
          <Controller
            control={control}
            name="streamSettings.sockopt.customSockopt"
            render={({ field }) => (
              <SockoptCustomField value={field.value} onChange={field.onChange} />
            )}
          />
        </SockoptFieldsContainer>
      )}
    </>
  );
}
