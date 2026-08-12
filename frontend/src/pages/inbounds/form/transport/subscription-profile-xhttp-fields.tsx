import { useTranslation } from 'react-i18next';
import {
  AutoComplete,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  type FormInstance,
} from 'antd';

import { HeaderMapEditor } from '@/components/form';
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
import { int32RangeUpper } from '@/lib/xray/stream-wire-normalize';
import {
  validateSessionIDLength,
  validateSessionIDTable,
} from '@/lib/xray/xhttp-session-id';
import {
  ProfileTransportBlock,
  ProfileTransportField,
  ProfileTransportGrid,
  ProfileTransportToggleRow,
} from '@/pages/inbounds/form/transport/subscription-profile-transport-ui';
import { XHTTP_SESSION_ID_TABLES } from '@/schemas/protocols/stream/xhttp';

interface ProfileXhttpTransportFieldsProps {
  fieldName: number;
  absoluteBase: (string | number)[];
  form: FormInstance;
}

export default function ProfileXhttpTransportFields({
  fieldName,
  absoluteBase,
  form,
}: ProfileXhttpTransportFieldsProps) {
  const { t } = useTranslation();
  const settingsPath = [...absoluteBase, 'xhttpSettings'];
  const mode = Form.useWatch([...settingsPath, 'mode'], form) as
    | string
    | undefined;
  const visibility = xhttpModeVisibility(mode);
  const paddingObfs =
    Form.useWatch([...settingsPath, 'xPaddingObfsMode'], form) === true;
  const sessionIDPlacement = Form.useWatch(
    [...settingsPath, 'sessionIDPlacement'],
    form,
  ) as string | undefined;
  const sessionIDTable = Form.useWatch(
    [...settingsPath, 'sessionIDTable'],
    form,
  ) as string | undefined;
  const sequencePlacement = Form.useWatch(
    [...settingsPath, 'seqPlacement'],
    form,
  ) as string | undefined;
  const uplinkDataPlacement = Form.useWatch(
    [...settingsPath, 'uplinkDataPlacement'],
    form,
  ) as string | undefined;
  const xmux = Form.useWatch([...settingsPath, 'xmux'], {
    form,
    preserve: true,
  }) as Record<string, unknown> | undefined;

  const scalarOrRangeRule = {
    validator: async (_rule: unknown, value: unknown) => {
      if (!isValidXhttpScalarOrRange(value)) {
        throw new Error(t('pages.inbounds.form.invalidScalarOrRange'));
      }
    },
  };

  const placementKeyRule = {
    required: true,
    whitespace: true,
    message: t('pages.inbounds.form.placementKeyRequired'),
  };

  function currentSettings(): Record<string, unknown> {
    const current = form.getFieldValue(settingsPath);
    return current && typeof current === 'object' ? current : {};
  }

  function replaceSettings(next: Record<string, unknown>): void {
    form.setFieldValue(settingsPath, next);
  }

  function sanitizeWith(patch: Record<string, unknown>): void {
    replaceSettings(sanitizeXhttpSettings({ ...currentSettings(), ...patch }));
  }

  function onXmuxMaxConcurrencyChange(value: unknown): void {
    if (int32RangeUpper(value) <= 0) return;
    if (
      int32RangeUpper(
        form.getFieldValue([...settingsPath, 'xmux', 'maxConnections']),
      ) > 0
    ) {
      form.setFieldValue([...settingsPath, 'xmux', 'maxConnections'], 0);
    }
  }

  function onXmuxMaxConnectionsChange(value: unknown): void {
    if (int32RangeUpper(value) <= 0) return;
    if (
      int32RangeUpper(
        form.getFieldValue([...settingsPath, 'xmux', 'maxConcurrency']),
      ) > 0
    ) {
      form.setFieldValue([...settingsPath, 'xmux', 'maxConcurrency'], '');
    }
  }

  return (
    <div className="ext-proxy-transport-shell ext-proxy-xhttp-shell" data-transport="xhttp">
      <ProfileTransportBlock
        title={t('pages.inbounds.form.profileTransportConnection', {
          defaultValue: 'Connection',
        })}
        description={t('pages.inbounds.form.profileXhttpConnectionHint', {
          defaultValue: 'Configure the endpoint and XHTTP operating mode.',
        })}
      >
        <ProfileTransportGrid columns={3}>
          <ProfileTransportField label={t('host')}>
            <Form.Item name={[fieldName, 'xhttpSettings', 'host']} noStyle>
              <Input />
            </Form.Item>
          </ProfileTransportField>
          <ProfileTransportField label={t('path')}>
            <Form.Item name={[fieldName, 'xhttpSettings', 'path']} noStyle>
              <Input />
            </Form.Item>
          </ProfileTransportField>
          <ProfileTransportField label={t('pages.inbounds.info.mode')}>
            <Form.Item name={[fieldName, 'xhttpSettings', 'mode']} noStyle>
              <Select
                options={XHTTP_MODES.map((value) => ({ value, label: value }))}
                onChange={(value) => {
                  replaceSettings(
                    prepareXhttpSettingsForMode(currentSettings(), value),
                  );
                }}
              />
            </Form.Item>
          </ProfileTransportField>
        </ProfileTransportGrid>
      </ProfileTransportBlock>

      <ProfileTransportBlock
        title={t('pages.inbounds.form.profileXhttpUploadSettings', {
          defaultValue: 'Upload and server limits',
        })}
        description={t('pages.inbounds.form.profileXhttpUploadSettingsHint', {
          defaultValue: 'Tune upload pacing, buffering and HTTP limits for the selected mode.',
        })}
      >
        <ProfileTransportGrid columns={3}>
          {visibility.maxUploadSize && (
            <ProfileTransportField
              label={t('pages.inbounds.form.maxUploadSize')}
            >
              <Form.Item
                name={[fieldName, 'xhttpSettings', 'scMaxEachPostBytes']}
                rules={[scalarOrRangeRule]}
                noStyle
              >
                <Input />
              </Form.Item>
            </ProfileTransportField>
          )}
          {visibility.maxBufferedUpload && (
            <ProfileTransportField
              label={t('pages.inbounds.form.maxBufferedUpload')}
            >
              <Form.Item
                name={[fieldName, 'xhttpSettings', 'scMaxBufferedPosts']}
                noStyle
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </ProfileTransportField>
          )}
          {visibility.minUploadInterval && (
            <ProfileTransportField
              label={t('pages.xray.outboundForm.minUploadInterval')}
            >
              <Form.Item
                name={[fieldName, 'xhttpSettings', 'scMinPostsIntervalMs']}
                rules={[scalarOrRangeRule]}
                noStyle
              >
                <Input placeholder="e.g. 50-150" />
              </Form.Item>
            </ProfileTransportField>
          )}
          {visibility.streamUpServer && (
            <ProfileTransportField
              label={t('pages.inbounds.form.streamUpServer')}
            >
              <Form.Item
                name={[fieldName, 'xhttpSettings', 'scStreamUpServerSecs']}
                rules={[scalarOrRangeRule]}
                noStyle
              >
                <Input placeholder="20-80" />
              </Form.Item>
            </ProfileTransportField>
          )}
          <ProfileTransportField
            label={t('pages.inbounds.form.serverMaxHeaderBytes')}
          >
            <Form.Item
              name={[fieldName, 'xhttpSettings', 'serverMaxHeaderBytes']}
              noStyle
            >
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </ProfileTransportField>
          <ProfileTransportField
            label={t('pages.inbounds.form.paddingBytes')}
          >
            <Form.Item
              name={[fieldName, 'xhttpSettings', 'xPaddingBytes']}
              rules={[scalarOrRangeRule]}
              noStyle
            >
              <Input placeholder="100-1000" />
            </Form.Item>
          </ProfileTransportField>
          <ProfileTransportField
            label={t('pages.inbounds.form.uplinkHttpMethod')}
          >
            <Form.Item
              name={[fieldName, 'xhttpSettings', 'uplinkHTTPMethod']}
              noStyle
            >
              <Select
                options={[
                  { value: '', label: 'Default (POST)' },
                  ...XHTTP_UPLINK_HTTP_METHODS.map((value) => ({
                    value,
                    label: value === 'GET' ? 'GET (packet-up only)' : value,
                    disabled: value === 'GET' && mode !== 'packet-up',
                  })),
                ]}
              />
            </Form.Item>
          </ProfileTransportField>
        </ProfileTransportGrid>
      </ProfileTransportBlock>

      <ProfileTransportBlock
        title={t('pages.inbounds.form.headers')}
        description={t('pages.inbounds.form.profileTransportHeadersHint', {
          defaultValue: 'Add optional headers sent with XHTTP requests.',
        })}
        className="ext-proxy-transport-block--headers"
      >
        <Form.Item name={[fieldName, 'xhttpSettings', 'headers']} noStyle>
          <HeaderMapEditor
            mode="v1"
            variant="profile"
            label={t('pages.inbounds.form.headers')}
          />
        </Form.Item>
      </ProfileTransportBlock>

      <ProfileTransportBlock
        title={t('pages.inbounds.form.profileXhttpPaddingObfuscation', {
          defaultValue: 'Padding obfuscation',
        })}
        description={t('pages.inbounds.form.profileXhttpPaddingObfuscationHint', {
          defaultValue: 'Control how padding is named, placed and generated.',
        })}
        className="ext-proxy-transport-block--toggle-section"
      >
        <ProfileTransportToggleRow
          label={t('pages.inbounds.form.paddingObfsMode')}
          hint={t('pages.inbounds.form.profileXhttpPaddingToggleHint', {
            defaultValue: 'Enable custom padding placement and generation settings.',
          })}
          control={(
            <Form.Item
              name={[fieldName, 'xhttpSettings', 'xPaddingObfsMode']}
              valuePropName="checked"
              noStyle
            >
              <Switch
                onChange={(checked) => {
                  sanitizeWith({ xPaddingObfsMode: checked });
                }}
              />
            </Form.Item>
          )}
        />
        {paddingObfs && (
          <ProfileTransportGrid columns={2}>
            <ProfileTransportField
              label={t('pages.inbounds.form.paddingKey')}
            >
              <Form.Item
                name={[fieldName, 'xhttpSettings', 'xPaddingKey']}
                noStyle
              >
                <Input placeholder="x_padding" />
              </Form.Item>
            </ProfileTransportField>
            <ProfileTransportField
              label={t('pages.inbounds.form.paddingHeader')}
            >
              <Form.Item
                name={[fieldName, 'xhttpSettings', 'xPaddingHeader']}
                noStyle
              >
                <Input placeholder="X-Padding" />
              </Form.Item>
            </ProfileTransportField>
            <ProfileTransportField
              label={t('pages.inbounds.form.paddingPlacement')}
            >
              <Form.Item
                name={[fieldName, 'xhttpSettings', 'xPaddingPlacement']}
                noStyle
              >
                <Select
                  options={[
                    { value: '', label: 'Default (queryInHeader)' },
                    ...XHTTP_PADDING_PLACEMENTS.map((value) => ({
                      value,
                      label: value,
                    })),
                  ]}
                />
              </Form.Item>
            </ProfileTransportField>
            <ProfileTransportField
              label={t('pages.inbounds.form.paddingMethod')}
            >
              <Form.Item
                name={[fieldName, 'xhttpSettings', 'xPaddingMethod']}
                noStyle
              >
                <Select
                  options={[
                    { value: '', label: 'Default (repeat-x)' },
                    ...XHTTP_PADDING_METHODS.map((value) => ({
                      value,
                      label: value,
                    })),
                  ]}
                />
              </Form.Item>
            </ProfileTransportField>
          </ProfileTransportGrid>
        )}
      </ProfileTransportBlock>

      <ProfileTransportBlock
        title={t('pages.inbounds.form.profileXhttpSessionRouting', {
          defaultValue: 'Session routing',
        })}
        description={t('pages.inbounds.form.profileXhttpSessionRoutingHint', {
          defaultValue: 'Choose where the session ID is placed and how it is encoded.',
        })}
      >
        <ProfileTransportGrid columns={2}>
          <ProfileTransportField
            label={t('pages.inbounds.form.sessionPlacement')}
          >
            <Form.Item
              name={[fieldName, 'xhttpSettings', 'sessionIDPlacement']}
              noStyle
            >
              <Select
                options={[
                  { value: '', label: 'Default (path)' },
                  ...XHTTP_PLACEMENTS.map((value) => ({ value, label: value })),
                ]}
                onChange={(value) =>
                  sanitizeWith({ sessionIDPlacement: value })
                }
              />
            </Form.Item>
          </ProfileTransportField>
          {xhttpPlacementRequiresKey(sessionIDPlacement) && (
            <ProfileTransportField
              label={t('pages.inbounds.form.sessionKey')}
            >
              <Form.Item
                name={[fieldName, 'xhttpSettings', 'sessionIDKey']}
                rules={[placementKeyRule]}
                noStyle
              >
                <Input placeholder="x_session" />
              </Form.Item>
            </ProfileTransportField>
          )}
          <ProfileTransportField
            label={t('pages.inbounds.form.sessionIDTable')}
          >
            <Form.Item
              name={[fieldName, 'xhttpSettings', 'sessionIDTable']}
              rules={[
                {
                  validator: (_rule, value) =>
                    validateSessionIDTable(undefined, value),
                },
              ]}
              noStyle
            >
              <AutoComplete
                allowClear
                options={XHTTP_SESSION_ID_TABLES.map((value) => ({ value }))}
                placeholder="Base62"
                onChange={(value) => {
                  if (!value) sanitizeWith({ sessionIDTable: '' });
                }}
              />
            </Form.Item>
          </ProfileTransportField>
          {!!sessionIDTable && (
            <ProfileTransportField
              label={t('pages.inbounds.form.sessionIDLength')}
            >
              <Form.Item
                name={[fieldName, 'xhttpSettings', 'sessionIDLength']}
                rules={[
                  {
                    validator: (_rule, value) =>
                      validateSessionIDLength(undefined, value),
                  },
                ]}
                noStyle
              >
                <Input placeholder="8-16" />
              </Form.Item>
            </ProfileTransportField>
          )}
        </ProfileTransportGrid>
      </ProfileTransportBlock>

      <ProfileTransportBlock
        title={t('pages.inbounds.form.profileXhttpSequenceRouting', {
          defaultValue: 'Sequence and uplink routing',
        })}
        description={t('pages.inbounds.form.profileXhttpSequenceRoutingHint', {
          defaultValue: 'Place sequence numbers and optional uplink data metadata.',
        })}
      >
        <ProfileTransportGrid columns={2}>
          <ProfileTransportField
            label={t('pages.inbounds.form.sequencePlacement')}
          >
            <Form.Item
              name={[fieldName, 'xhttpSettings', 'seqPlacement']}
              noStyle
            >
              <Select
                options={[
                  { value: '', label: 'Default (path)' },
                  ...XHTTP_PLACEMENTS.map((value) => ({ value, label: value })),
                ]}
                onChange={(value) => sanitizeWith({ seqPlacement: value })}
              />
            </Form.Item>
          </ProfileTransportField>
          {xhttpPlacementRequiresKey(sequencePlacement) && (
            <ProfileTransportField
              label={t('pages.inbounds.form.sequenceKey')}
            >
              <Form.Item
                name={[fieldName, 'xhttpSettings', 'seqKey']}
                rules={[placementKeyRule]}
                noStyle
              >
                <Input placeholder="x_seq" />
              </Form.Item>
            </ProfileTransportField>
          )}
          {visibility.uplinkDataPlacement && (
            <ProfileTransportField
              label={t('pages.inbounds.form.uplinkDataPlacement')}
            >
              <Form.Item
                name={[fieldName, 'xhttpSettings', 'uplinkDataPlacement']}
                noStyle
              >
                <Select
                  options={[
                    { value: '', label: 'Default (body)' },
                    ...XHTTP_UPLINK_DATA_PLACEMENTS.map((value) => ({
                      value,
                      label: value,
                    })),
                  ]}
                  onChange={(value) =>
                    sanitizeWith({ uplinkDataPlacement: value })
                  }
                />
              </Form.Item>
            </ProfileTransportField>
          )}
          {visibility.uplinkDataPlacement &&
            xhttpPlacementRequiresKey(uplinkDataPlacement) && (
              <ProfileTransportField
                label={t('pages.inbounds.form.uplinkDataKey')}
              >
                <Form.Item
                  name={[fieldName, 'xhttpSettings', 'uplinkDataKey']}
                  rules={[placementKeyRule]}
                  noStyle
                >
                  <Input placeholder="x_data" />
                </Form.Item>
              </ProfileTransportField>
            )}
        </ProfileTransportGrid>
      </ProfileTransportBlock>

      <ProfileTransportBlock
        title="XMUX"
        description={t('pages.inbounds.form.profileXhttpXmuxHint', {
          defaultValue: 'Multiplex XHTTP requests with explicit concurrency and reuse limits.',
        })}
        className="ext-proxy-transport-block--toggle-section"
      >
        <ProfileTransportToggleRow
          label="XMUX"
          hint={t('pages.inbounds.form.profileXhttpXmuxToggleHint', {
            defaultValue: 'Enable XHTTP request multiplexing for this profile.',
          })}
          control={(
            <Switch
              checked={xmux != null}
              onChange={(checked) => {
                form.setFieldValue(
                  [...settingsPath, 'xmux'],
                  checked ? createFreshXhttpXmux() : undefined,
                );
              }}
            />
          )}
        />
        {xmux != null && (
          <ProfileTransportGrid columns={3}>
            <ProfileTransportField
              label={t('pages.xray.outboundForm.maxConcurrency')}
            >
              <Form.Item
                name={[fieldName, 'xhttpSettings', 'xmux', 'maxConcurrency']}
                rules={[scalarOrRangeRule]}
                noStyle
              >
                <Input
                  placeholder="16-32"
                  onChange={(event) =>
                    onXmuxMaxConcurrencyChange(event.target.value)
                  }
                />
              </Form.Item>
            </ProfileTransportField>
            <ProfileTransportField
              label={t('pages.xray.outboundForm.maxConnections')}
            >
              <Form.Item
                name={[fieldName, 'xhttpSettings', 'xmux', 'maxConnections']}
                rules={[scalarOrRangeRule]}
                noStyle
              >
                <Input
                  placeholder="6"
                  onChange={(event) =>
                    onXmuxMaxConnectionsChange(event.target.value)
                  }
                />
              </Form.Item>
            </ProfileTransportField>
            <ProfileTransportField
              label={t('pages.xray.outboundForm.maxReuseTimes')}
            >
              <Form.Item
                name={[fieldName, 'xhttpSettings', 'xmux', 'cMaxReuseTimes']}
                rules={[scalarOrRangeRule]}
                noStyle
              >
                <Input placeholder="0" />
              </Form.Item>
            </ProfileTransportField>
            <ProfileTransportField
              label={t('pages.xray.outboundForm.maxRequestTimes')}
            >
              <Form.Item
                name={[fieldName, 'xhttpSettings', 'xmux', 'hMaxRequestTimes']}
                rules={[scalarOrRangeRule]}
                noStyle
              >
                <Input placeholder="600-900" />
              </Form.Item>
            </ProfileTransportField>
            <ProfileTransportField
              label={t('pages.xray.outboundForm.maxReusableSecs')}
            >
              <Form.Item
                name={[fieldName, 'xhttpSettings', 'xmux', 'hMaxReusableSecs']}
                rules={[scalarOrRangeRule]}
                noStyle
              >
                <Input placeholder="1800-3000" />
              </Form.Item>
            </ProfileTransportField>
            <ProfileTransportField
              label={t('pages.xray.outboundForm.keepAlivePeriod')}
            >
              <Form.Item
                name={[fieldName, 'xhttpSettings', 'xmux', 'hKeepAlivePeriod']}
                noStyle
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </ProfileTransportField>
          </ProfileTransportGrid>
        )}
      </ProfileTransportBlock>

      <ProfileTransportBlock
        title={t('pages.inbounds.form.profileTransportAdvanced', {
          defaultValue: 'Advanced flags',
        })}
        description={t('pages.inbounds.form.profileXhttpAdvancedHint', {
          defaultValue: 'Low-level compatibility switches and chunk sizing.',
        })}
        className="ext-proxy-transport-block--advanced"
      >
        <ProfileTransportGrid columns={2}>
          <ProfileTransportField
            label={t('pages.xray.outboundForm.uplinkChunkSize')}
            wide
          >
            <Form.Item
              name={[fieldName, 'xhttpSettings', 'uplinkChunkSize']}
              noStyle
            >
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </ProfileTransportField>
        </ProfileTransportGrid>
        <ProfileTransportGrid columns={1}>
          <ProfileTransportToggleRow
            label={t('pages.inbounds.form.noSseHeader')}
            hint={t('pages.inbounds.form.profileXhttpNoSseHeaderHint', {
              defaultValue: 'Suppress the SSE content type header when compatibility requires it.',
            })}
            control={(
              <Form.Item
                name={[fieldName, 'xhttpSettings', 'noSSEHeader']}
                valuePropName="checked"
                noStyle
              >
                <Switch />
              </Form.Item>
            )}
          />
          <ProfileTransportToggleRow
            label={t('pages.xray.outboundForm.noGrpcHeader')}
            hint={t('pages.inbounds.form.profileXhttpNoGrpcHeaderHint', {
              defaultValue: 'Suppress the gRPC-style header emitted by compatible modes.',
            })}
            control={(
              <Form.Item
                name={[fieldName, 'xhttpSettings', 'noGRPCHeader']}
                valuePropName="checked"
                noStyle
              >
                <Switch />
              </Form.Item>
            )}
          />
        </ProfileTransportGrid>
      </ProfileTransportBlock>
    </div>
  );
}
