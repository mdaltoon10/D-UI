import { useTranslation } from 'react-i18next';
import { AutoComplete, Input, InputNumber, Select, Switch } from 'antd';
import { useFormContext, useWatch } from 'react-hook-form';

import { HeaderMapEditor } from '@/components/form';
import { FormField } from '@/components/form/rhf';
import { XHTTP_SESSION_ID_TABLES } from '@/schemas/protocols/stream/xhttp';
import {
  XHTTP_MODES,
  XHTTP_PADDING_METHODS,
  XHTTP_PADDING_PLACEMENTS,
  XHTTP_PLACEMENTS,
  XHTTP_UPLINK_DATA_PLACEMENTS,
  XHTTP_UPLINK_HTTP_METHODS,
  createFreshXhttpXmux,
  isValidXhttpScalarOrRange,
  prepareXhttpSettingsForMode,
  sanitizeXhttpSettings,
  xhttpModeVisibility,
  xhttpPlacementRequiresKey,
} from '@/lib/xray/forms/transport/xhttp-foundation';
import { validateSessionIDLength, validateSessionIDTable } from '@/lib/xray/xhttp-session-id';
import { int32RangeUpper } from '@/lib/xray/stream-wire-normalize';

function antdValidatorToRhf(fn: (rule: unknown, value: unknown) => Promise<void>) {
  return async (value: unknown): Promise<true | string> => {
    try {
      await fn(undefined, value);
      return true;
    } catch (e) {
      return (e as Error).message;
    }
  };
}

export default function XhttpForm() {
  const { t } = useTranslation();
  const { control, getValues, setValue } = useFormContext();
  const xhttpMode = useWatch({ control, name: 'streamSettings.xhttpSettings.mode' }) as string | undefined;
  const xhttpObfsMode = !!useWatch({ control, name: 'streamSettings.xhttpSettings.xPaddingObfsMode' });
  const xhttpSessionIDPlacement = useWatch({ control, name: 'streamSettings.xhttpSettings.sessionIDPlacement' }) as string | undefined;
  const xhttpSessionIDTable = useWatch({ control, name: 'streamSettings.xhttpSettings.sessionIDTable' });
  const xhttpSeqPlacement = useWatch({ control, name: 'streamSettings.xhttpSettings.seqPlacement' }) as string | undefined;
  const xhttpUplinkPlacement = useWatch({ control, name: 'streamSettings.xhttpSettings.uplinkDataPlacement' }) as string | undefined;
  const enableXmux = !!useWatch({ control, name: 'streamSettings.xhttpSettings.enableXmux' });
  const visibility = xhttpModeVisibility(xhttpMode);

  const scalarOrRangeValidation = (value: unknown): true | string => (
    isValidXhttpScalarOrRange(value)
      ? true
      : t('pages.inbounds.form.invalidScalarOrRange')
  );

  const placementKeyValidation = (value: unknown): true | string => (
    typeof value === 'string' && value.trim() !== ''
      ? true
      : t('pages.inbounds.form.placementKeyRequired')
  );

  function sanitizeWith(patch: Record<string, unknown>) {
    const current = getValues('streamSettings.xhttpSettings');
    setValue(
      'streamSettings.xhttpSettings',
      sanitizeXhttpSettings(
        {
          ...(current && typeof current === 'object' ? current : {}),
          ...patch,
        },
        { stripUiOnly: false },
      ),
    );
  }

  function onXmuxToggle(checked: boolean) {
    if (!checked) return;
    const existing = getValues('streamSettings.xhttpSettings.xmux');
    const hasValues = existing && typeof existing === 'object' && Object.keys(existing).length > 0;
    if (hasValues) return;
    setValue('streamSettings.xhttpSettings.xmux', createFreshXhttpXmux());
  }

  function onXmuxMaxConcurrencyChange(value: unknown) {
    if (int32RangeUpper(value) <= 0) return;
    if (int32RangeUpper(getValues('streamSettings.xhttpSettings.xmux.maxConnections')) > 0) {
      setValue('streamSettings.xhttpSettings.xmux.maxConnections', 0);
    }
  }

  function onXmuxMaxConnectionsChange(value: unknown) {
    if (int32RangeUpper(value) <= 0) return;
    if (int32RangeUpper(getValues('streamSettings.xhttpSettings.xmux.maxConcurrency')) > 0) {
      setValue('streamSettings.xhttpSettings.xmux.maxConcurrency', '');
    }
  }

  return (
    <>
      <FormField name={['streamSettings', 'xhttpSettings', 'host']} label={t('host')}>
        <Input />
      </FormField>
      <FormField name={['streamSettings', 'xhttpSettings', 'path']} label={t('path')}>
        <Input />
      </FormField>
      <FormField
        name={['streamSettings', 'xhttpSettings', 'mode']}
        label={t('pages.inbounds.info.mode')}
        onAfterChange={(value) => {
          const current = getValues('streamSettings.xhttpSettings');
          setValue(
            'streamSettings.xhttpSettings',
            prepareXhttpSettingsForMode(
              current && typeof current === 'object' ? current : {},
              value,
            ),
          );
        }}
      >
        <Select
          style={{ width: '50%' }}
          options={XHTTP_MODES.map((value) => ({ value, label: value }))}
        />
      </FormField>
      {visibility.maxUploadSize && (
        <>
          <FormField
            name={['streamSettings', 'xhttpSettings', 'scMaxEachPostBytes']}
            label={t('pages.inbounds.form.maxUploadSize')}
            rules={{ validate: scalarOrRangeValidation }}
          >
            <Input />
          </FormField>
        </>
      )}
      {visibility.maxBufferedUpload && (
        <FormField
          name={['streamSettings', 'xhttpSettings', 'scMaxBufferedPosts']}
          label={t('pages.inbounds.form.maxBufferedUpload')}
        >
          <InputNumber min={0} />
        </FormField>
      )}
      {visibility.minUploadInterval && (
        <FormField
          name={['streamSettings', 'xhttpSettings', 'scMinPostsIntervalMs']}
          label={t('pages.xray.outboundForm.minUploadInterval')}
          rules={{ validate: scalarOrRangeValidation }}
        >
          <Input placeholder="e.g. 50-150" />
        </FormField>
      )}
      {visibility.streamUpServer && (
        <FormField
          name={['streamSettings', 'xhttpSettings', 'scStreamUpServerSecs']}
          label={t('pages.inbounds.form.streamUpServer')}
          rules={{ validate: scalarOrRangeValidation }}
        >
          <Input placeholder="20-80" />
        </FormField>
      )}
      <FormField
        name={['streamSettings', 'xhttpSettings', 'serverMaxHeaderBytes']}
        label={t('pages.inbounds.form.serverMaxHeaderBytes')}
      >
        <InputNumber min={0} placeholder="0 (default)" />
      </FormField>
      <FormField
        name={['streamSettings', 'xhttpSettings', 'xPaddingBytes']}
        label={t('pages.inbounds.form.paddingBytes')}
        rules={{ validate: scalarOrRangeValidation }}
      >
        <Input />
      </FormField>
      <FormField
        name={['streamSettings', 'xhttpSettings', 'headers']}
        label={t('pages.inbounds.form.headers')}
      >
        <HeaderMapEditor mode="v1" />
      </FormField>
      <FormField
        name={['streamSettings', 'xhttpSettings', 'uplinkHTTPMethod']}
        label={t('pages.inbounds.form.uplinkHttpMethod')}
      >
        <Select
          options={[
            { value: '', label: 'Default (POST)' },
            ...XHTTP_UPLINK_HTTP_METHODS.map((value) => ({
              value,
              label: value === 'GET' ? 'GET (packet-up only)' : value,
              disabled: value === 'GET' && xhttpMode !== 'packet-up',
            })),
          ]}
        />
      </FormField>
      <FormField
        name={['streamSettings', 'xhttpSettings', 'xPaddingObfsMode']}
        label={t('pages.inbounds.form.paddingObfsMode')}
        valueProp="checked"
        onAfterChange={(value) => {
          sanitizeWith({ xPaddingObfsMode: value === true });
        }}
      >
        <Switch />
      </FormField>
      {xhttpObfsMode && (
        <>
          <FormField
            name={['streamSettings', 'xhttpSettings', 'xPaddingKey']}
            label={t('pages.inbounds.form.paddingKey')}
          >
            <Input placeholder="x_padding" />
          </FormField>
          <FormField
            name={['streamSettings', 'xhttpSettings', 'xPaddingHeader']}
            label={t('pages.inbounds.form.paddingHeader')}
          >
            <Input placeholder="X-Padding" />
          </FormField>
          <FormField
            name={['streamSettings', 'xhttpSettings', 'xPaddingPlacement']}
            label={t('pages.inbounds.form.paddingPlacement')}
          >
            <Select
              options={[
                { value: '', label: 'Default (queryInHeader)' },
                ...XHTTP_PADDING_PLACEMENTS.map((value) => ({ value, label: value })),
              ]}
            />
          </FormField>
          <FormField
            name={['streamSettings', 'xhttpSettings', 'xPaddingMethod']}
            label={t('pages.inbounds.form.paddingMethod')}
          >
            <Select
              options={[
                { value: '', label: 'Default (repeat-x)' },
                ...XHTTP_PADDING_METHODS.map((value) => ({ value, label: value })),
              ]}
            />
          </FormField>
        </>
      )}
      <FormField
        name={['streamSettings', 'xhttpSettings', 'sessionIDPlacement']}
        label={t('pages.inbounds.form.sessionPlacement')}
        onAfterChange={(value) => sanitizeWith({ sessionIDPlacement: value })}
      >
        <Select
          options={[
            { value: '', label: 'Default (path)' },
            ...XHTTP_PLACEMENTS.map((value) => ({ value, label: value })),
          ]}
        />
      </FormField>
      {xhttpPlacementRequiresKey(xhttpSessionIDPlacement) && (
        <FormField
          name={['streamSettings', 'xhttpSettings', 'sessionIDKey']}
          label={t('pages.inbounds.form.sessionKey')}
          rules={{ validate: placementKeyValidation }}
        >
          <Input placeholder="x_session" />
        </FormField>
      )}
      <FormField
        name={['streamSettings', 'xhttpSettings', 'sessionIDTable']}
        label={t('pages.inbounds.form.sessionIDTable')}
        tooltip={t('pages.inbounds.form.sessionIDTableHint')}
        rules={{ validate: antdValidatorToRhf(validateSessionIDTable) }}
      >
        <AutoComplete
          allowClear
          options={XHTTP_SESSION_ID_TABLES.map((v) => ({ value: v }))}
          placeholder="Base62"
          onChange={(value) => {
            if (!value) sanitizeWith({ sessionIDTable: '' });
          }}
        />
      </FormField>
      {!!xhttpSessionIDTable && (
        <FormField
          name={['streamSettings', 'xhttpSettings', 'sessionIDLength']}
          label={t('pages.inbounds.form.sessionIDLength')}
          tooltip={t('pages.inbounds.form.sessionIDLengthHint')}
          rules={{ validate: antdValidatorToRhf(validateSessionIDLength) }}
        >
          <Input placeholder="8-16" />
        </FormField>
      )}
      <FormField
        name={['streamSettings', 'xhttpSettings', 'seqPlacement']}
        label={t('pages.inbounds.form.sequencePlacement')}
        onAfterChange={(value) => sanitizeWith({ seqPlacement: value })}
      >
        <Select
          options={[
            { value: '', label: 'Default (path)' },
            ...XHTTP_PLACEMENTS.map((value) => ({ value, label: value })),
          ]}
        />
      </FormField>
      {xhttpPlacementRequiresKey(xhttpSeqPlacement) && (
        <FormField
          name={['streamSettings', 'xhttpSettings', 'seqKey']}
          label={t('pages.inbounds.form.sequenceKey')}
          rules={{ validate: placementKeyValidation }}
        >
          <Input placeholder="x_seq" />
        </FormField>
      )}
      {visibility.uplinkDataPlacement && (
        <>
          <FormField
            name={['streamSettings', 'xhttpSettings', 'uplinkDataPlacement']}
            label={t('pages.inbounds.form.uplinkDataPlacement')}
            onAfterChange={(value) => sanitizeWith({ uplinkDataPlacement: value })}
          >
            <Select
              options={[
                { value: '', label: 'Default (body)' },
                ...XHTTP_UPLINK_DATA_PLACEMENTS.map((value) => ({ value, label: value })),
              ]}
            />
          </FormField>
          {xhttpPlacementRequiresKey(xhttpUplinkPlacement) && (
            <FormField
              name={['streamSettings', 'xhttpSettings', 'uplinkDataKey']}
              label={t('pages.inbounds.form.uplinkDataKey')}
              rules={{ validate: placementKeyValidation }}
            >
              <Input placeholder="x_data" />
            </FormField>
          )}
        </>
      )}
      <FormField
        name={['streamSettings', 'xhttpSettings', 'noSSEHeader']}
        label={t('pages.inbounds.form.noSseHeader')}
        valueProp="checked"
      >
        <Switch />
      </FormField>
      {/* XMUX is the connection-multiplexing layer
          xHTTP uses to fan out parallel requests over
          a small pool of upstream connections. UI-only
          toggle (enableXmux) hides the 6 nested knobs
          when off. */}
      <FormField
        label="XMUX"
        name={['streamSettings', 'xhttpSettings', 'enableXmux']}
        valueProp="checked"
        onAfterChange={(v) => onXmuxToggle(v as boolean)}
      >
        <Switch />
      </FormField>
      {enableXmux && (
        <>
          <FormField
            label={t('pages.xray.outboundForm.maxConcurrency')}
            name={['streamSettings', 'xhttpSettings', 'xmux', 'maxConcurrency']}
            rules={{ validate: scalarOrRangeValidation }}
            onAfterChange={onXmuxMaxConcurrencyChange}
          >
            <Input placeholder="16-32" />
          </FormField>
          <FormField
            label={t('pages.xray.outboundForm.maxConnections')}
            name={['streamSettings', 'xhttpSettings', 'xmux', 'maxConnections']}
            rules={{ validate: scalarOrRangeValidation }}
            onAfterChange={onXmuxMaxConnectionsChange}
          >
            <Input placeholder="0" />
          </FormField>
          <FormField
            label={t('pages.xray.outboundForm.maxReuseTimes')}
            name={['streamSettings', 'xhttpSettings', 'xmux', 'cMaxReuseTimes']}
            rules={{ validate: scalarOrRangeValidation }}
          >
            <Input />
          </FormField>
          <FormField
            label={t('pages.xray.outboundForm.maxRequestTimes')}
            name={['streamSettings', 'xhttpSettings', 'xmux', 'hMaxRequestTimes']}
            rules={{ validate: scalarOrRangeValidation }}
          >
            <Input placeholder="600-900" />
          </FormField>
          <FormField
            label={t('pages.xray.outboundForm.maxReusableSecs')}
            name={['streamSettings', 'xhttpSettings', 'xmux', 'hMaxReusableSecs']}
            rules={{ validate: scalarOrRangeValidation }}
          >
            <Input placeholder="1800-3000" />
          </FormField>
          <FormField
            label={t('pages.xray.outboundForm.keepAlivePeriod')}
            name={['streamSettings', 'xhttpSettings', 'xmux', 'hKeepAlivePeriod']}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </FormField>
        </>
      )}
    </>
  );
}
