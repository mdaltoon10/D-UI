import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  message,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { NodeRecord } from '@/api/queries/useNodesQuery';
import type { RemoteInboundOption } from '@/api/queries/useNodeMutations';
import type { Msg } from '@/utils';
import { NodeFormSchema, type NodeFormValues, type ProbeResult } from '@/schemas/node';
import { antdRule } from '@/utils/zodForm';
import { useOutboundTagGroups } from '@/api/queries/useOutboundTags';
import { useInboundOptions } from '@/api/queries/useInboundOptions';
import './NodeFormModal.css';

type Mode = 'add' | 'edit';

interface NodeFormModalProps {
  open: boolean;
  mode: Mode;
  node: NodeRecord | null;
  testConnection: (payload: Partial<NodeRecord>) => Promise<Msg<ProbeResult>>;
  fetchFingerprint: (payload: Partial<NodeRecord>) => Promise<Msg<string>>;
  fetchInbounds: (payload: Partial<NodeRecord>) => Promise<Msg<RemoteInboundOption[]>>;
  save: (payload: Partial<NodeRecord>) => Promise<Msg<unknown>>;
  onOpenChange: (open: boolean) => void;
}

function defaultValues(): NodeFormValues {
  return {
    id: 0,
    name: '',
    remark: '',
    scheme: 'https',
    address: '',
    port: 2053,
    basePath: '/',
    apiToken: '',
    enable: true,
    allowPrivateAddress: false,
    tlsVerifyMode: 'verify',
    pinnedCertSha256: '',
    inboundSyncMode: 'all',
    inboundTags: [],
    inboundOverrides: [],
    outboundTag: '',
    publicAddress: '',
  };
}

export default function NodeFormModal({
  open,
  mode,
  node,
  testConnection,
  fetchFingerprint,
  fetchInbounds,
  save,
  onOpenChange,
}: NodeFormModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<NodeFormValues>();
  const [messageApi, messageContextHolder] = message.useMessage();

  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [fetchingPin, setFetchingPin] = useState(false);
  const [fetchingInbounds, setFetchingInbounds] = useState(false);
  const [inboundOptions, setInboundOptions] = useState<RemoteInboundOption[]>([]);
  const [testResult, setTestResult] = useState<ProbeResult | null>(null);
  const scheme = Form.useWatch('scheme', form) ?? 'https';
  const tlsVerifyMode = Form.useWatch('tlsVerifyMode', form) ?? 'verify';
  const inboundSyncMode = Form.useWatch('inboundSyncMode', form) ?? 'all';
  const { data: outboundGroups } = useOutboundTagGroups({ excludeBlackhole: true });
  const { data: mainInbounds = [] } = useInboundOptions();

  const combinedInboundOptions = useMemo(() => {
    const map = new Map<string, { value: string; label: string }>();

    // Add from mainInbounds
    for (const ib of mainInbounds || []) {
      const val = ib.tag || ib.remark || String(ib.id);
      const label = `${ib.remark || ib.tag}${ib.port ? ` (Port ${ib.port})` : ''}`;
      map.set(val, { value: val, label });
    }

    // Add/override from remote fetched inbounds
    for (const ib of inboundOptions || []) {
      const val = ib.tag || ib.remark || String(ib.id);
      if (!map.has(val)) {
        map.set(val, { value: val, label: `${ib.remark || ib.tag}${ib.port ? ` (Port ${ib.port})` : ''}` });
      }
    }

    return Array.from(map.values());
  }, [mainInbounds, inboundOptions]);

  const overrideSelectOptions = useMemo(() => {
    const inboundOptionsList = combinedInboundOptions.map((ib) => ({
      value: `inbound:${ib.value}`,
      label: `⚡ ${ib.label}`,
    }));

    const result = [];
    if (inboundOptionsList.length > 0) {
      result.push({
        label: t('pages.nodes.typeInbound'),
        options: inboundOptionsList,
      });
    }
    return result;
  }, [combinedInboundOptions, t]);
  // when balancers exist they get a labeled group so it's clear the selection
  // routes through a balancer. Empty falls back to the placeholder ("Direct
  // connection") rather than a synthetic option, so it can't read as a second
  // "direct" next to a real freedom outbound.
  const outboundOptions = useMemo<
    ({ label: string; value: string } | { label: string; options: { label: string; value: string }[] })[]
  >(() => {
    const outOpts = (outboundGroups?.outbounds ?? []).map((tag) => ({ label: tag, value: tag }));
    if (!outboundGroups?.balancers.length) return outOpts;
    return [
      { label: t('pages.xray.Outbounds'), options: outOpts },
      { label: t('pages.xray.Balancers'), options: outboundGroups.balancers.map((tag) => ({ label: tag, value: tag })) },
    ];
  }, [outboundGroups, t]);

  useEffect(() => {
    if (!open) return;
    const base = defaultValues();
    const next: NodeFormValues = mode === 'edit' && node
      ? {
        ...base,
        ...(node as unknown as Partial<NodeFormValues>),
        id: node.id,
        scheme: (node.scheme as 'http' | 'https') || base.scheme,
        inboundSyncMode: (node.inboundSyncMode as 'all' | 'selected') || base.inboundSyncMode,
        inboundTags: node.inboundTags ?? [],
        inboundOverrides: node.inboundOverrides ?? [],
      }
      : base;
    if (next.scheme === 'http') next.tlsVerifyMode = 'skip';
    form.resetFields();
    form.setFieldsValue(next);
    setInboundOptions((next.inboundTags || []).map((tag) => ({ tag })));
    setTestResult(null);
  }, [open, mode, node, form]);

  const title = useMemo(
    () => (mode === 'edit' ? t('pages.nodes.editNode') : t('pages.nodes.addNode')),
    [mode, t],
  );

  function buildPayload(values: NodeFormValues): Partial<NodeRecord> {
    return {
      id: values.id || 0,
      name: values.name.trim(),
      remark: values.remark?.trim() || '',
      scheme: values.scheme,
      address: values.address.trim(),
      port: values.port,
      basePath: values.basePath.trim() || '/',
      apiToken: values.apiToken.trim(),
      enable: values.enable,
      allowPrivateAddress: values.allowPrivateAddress,
      tlsVerifyMode: values.tlsVerifyMode,
      pinnedCertSha256: values.tlsVerifyMode === 'pin' ? values.pinnedCertSha256.trim() : '',
      inboundSyncMode: values.inboundSyncMode,
      inboundTags: values.inboundSyncMode === 'selected' ? values.inboundTags : [],
      inboundOverrides: values.inboundOverrides || [],
      outboundTag: values.outboundTag || '',
      publicAddress: values.publicAddress?.trim() || '',
    };
  }

  async function onTest() {
    try {
      await form.validateFields(['address', 'port']);
    } catch {
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const payload = buildPayload(form.getFieldsValue(true));
      const msg = await testConnection(payload);
      if (msg?.success && msg.obj) {
        setTestResult(msg.obj);
      } else {
        setTestResult({ status: 'offline', error: msg?.msg || 'unknown error' });
      }
    } finally {
      setTesting(false);
    }
  }

  async function onFetchPin() {
    try {
      await form.validateFields(['address', 'port']);
    } catch {
      return;
    }
    setFetchingPin(true);
    try {
      const payload = buildPayload(form.getFieldsValue(true));
      const msg = await fetchFingerprint(payload);
      if (msg?.success && msg.obj) {
        form.setFieldValue('pinnedCertSha256', msg.obj);
        messageApi.success(t('pages.nodes.pinFetched'));
      } else {
        messageApi.error(msg?.msg || t('pages.nodes.pinFetchFailed'));
      }
    } finally {
      setFetchingPin(false);
    }
  }

  async function onFetchInbounds() {
    try {
      await form.validateFields(['name', 'address', 'port', 'apiToken']);
    } catch {
      return;
    }
    setFetchingInbounds(true);
    try {
      const msg = await fetchInbounds(buildPayload(form.getFieldsValue(true)));
      if (msg?.success && Array.isArray(msg.obj)) {
        setInboundOptions(msg.obj);
        messageApi.success(t('pages.nodes.inboundsLoaded', { count: msg.obj.length }));
      } else {
        messageApi.error(msg?.msg || t('pages.nodes.inboundsLoadFailed'));
      }
    } finally {
      setFetchingInbounds(false);
    }
  }

  async function onFinish(values: NodeFormValues) {
    const result = NodeFormSchema.safeParse(values);
    if (!result.success) {
      messageApi.error(t(result.error.issues[0]?.message ?? 'pages.nodes.toasts.fillRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const payload = buildPayload(result.data);
      const test = await testConnection(payload);
      const probe = test?.success ? test.obj : null;
      if (!probe || probe.status !== 'online') {
        setTestResult(probe ?? { status: 'offline', error: test?.msg || t('pages.nodes.connectionFailed') });
        return;
      }
      setTestResult(probe);
      const msg = await save(payload);
      if (msg?.success) {
        onOpenChange(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function close() {
    if (!submitting) onOpenChange(false);
  }

  return (
    <>
      {messageContextHolder}
      <Modal
        open={open}
        title={title}
        confirmLoading={submitting}
        okText={t('save')}
        cancelText={t('cancel')}
        mask={{ closable: false }}
        width="640px"
        onOk={() => form.submit()}
        onCancel={close}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={defaultValues()}
          onFinish={onFinish}
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label={t('pages.nodes.name')}
                name="name"
                rules={[antdRule(NodeFormSchema.shape.name, t)]}
              >
                <Input placeholder={t('pages.nodes.namePlaceholder')} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label={t('pages.nodes.remark')} name="remark">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={6}>
              <Form.Item label={t('pages.nodes.scheme')} name="scheme">
                <Select
                  options={[
                    { value: 'https', label: 'https' },
                    { value: 'http', label: 'http' },
                  ]}
                  onChange={(value) => {
                    if (value === 'http') form.setFieldValue('tlsVerifyMode', 'skip');
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label={t('pages.nodes.address')}
                name="address"
                rules={[antdRule(NodeFormSchema.shape.address, t)]}
              >
                <Input placeholder={t('pages.nodes.addressPlaceholder')} />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item
                label={t('pages.nodes.port')}
                name="port"
                rules={[antdRule(NodeFormSchema.shape.port, t)]}
              >
                <InputNumber min={1} max={65535} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label={t('pages.nodes.basePath')} name="basePath">
                <Input placeholder="/" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label={t('pages.nodes.publicAddress')}
                name="publicAddress"
                tooltip={t('pages.nodes.publicAddressHint')}
              >
                <Input placeholder={t('pages.nodes.publicAddressPlaceholder')} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label={t('pages.nodes.enable')}
            name="enable"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            label={t('pages.nodes.allowPrivateAddress')}
            name="allowPrivateAddress"
            valuePropName="checked"
            tooltip={t('pages.nodes.allowPrivateAddressHint')}
          >
            <Switch />
          </Form.Item>

          <Form.Item
            label={t('pages.nodes.tlsVerifyMode')}
            name="tlsVerifyMode"
            tooltip={t('pages.nodes.tlsVerifyModeHint')}
          >
            <Select
              disabled={scheme === 'http'}
              options={[
                { value: 'verify', label: t('pages.nodes.tlsVerify') },
                { value: 'pin', label: t('pages.nodes.tlsPin') },
                { value: 'skip', label: t('pages.nodes.tlsSkip') },
                { value: 'mtls', label: t('pages.nodes.tlsMtls') },
              ]}
            />
          </Form.Item>

          {tlsVerifyMode === 'skip' && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              title={t('pages.nodes.tlsSkipWarning')}
            />
          )}

          {tlsVerifyMode === 'mtls' && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              title={t('pages.nodes.mtlsFormHint')}
            />
          )}

          {tlsVerifyMode === 'pin' && (
            <Form.Item
              label={t('pages.nodes.pinnedCert')}
              name="pinnedCertSha256"
              tooltip={t('pages.nodes.pinnedCertHint')}
            >
              <Input.Search
                placeholder={t('pages.nodes.pinnedCertPlaceholder')}
                enterButton={t('pages.nodes.fetchPin')}
                loading={fetchingPin}
                onSearch={onFetchPin}
              />
            </Form.Item>
          )}

          <Form.Item
            label={t('pages.nodes.apiToken')}
            name="apiToken"
            rules={[antdRule(NodeFormSchema.shape.apiToken, t)]}
            tooltip={t('pages.nodes.apiTokenHint')}
          >
            <Input.Password placeholder={t('pages.nodes.apiTokenPlaceholder')} />
          </Form.Item>

          <Form.Item
            label={t('pages.nodes.outboundTag')}
            name="outboundTag"
            tooltip={t('pages.nodes.outboundTagHint')}
            getValueProps={(v) => ({ value: (v as string) || undefined })}
          >
            <Select
              allowClear
              showSearch
              placeholder={t('pages.nodes.outboundTagPlaceholder')}
              options={outboundOptions}
            />
          </Form.Item>

           <Form.Item
            label={t('pages.nodes.inboundSyncMode')}
            name="inboundSyncMode"
            tooltip={t('pages.nodes.inboundSyncModeHint')}
          >
            <Select
              options={[
                { value: 'all', label: t('pages.nodes.allInbounds') },
                { value: 'selected', label: t('pages.nodes.selectedInbounds') },
              ]}
            />
          </Form.Item>

          {inboundSyncMode === 'selected' && (
            <Form.Item
              label={t('pages.nodes.inboundTags')}
              name="inboundTags"
              tooltip={t('pages.nodes.inboundTagsHint')}
            >
              <Select
                mode="multiple"
                allowClear
                loading={fetchingInbounds}
                placeholder={t('pages.nodes.inboundTagsPlaceholder')}
                popupRender={(menu) => (
                  <>
                    <Button type="text" block loading={fetchingInbounds} onClick={onFetchInbounds}>
                      {t('pages.nodes.loadInbounds')}
                    </Button>
                    {menu}
                  </>
                )}
                options={inboundOptions.map((inbound) => ({
                  value: inbound.tag,
                  label: `${inbound.remark || inbound.tag}${inbound.protocol ? ` (${inbound.protocol}:${inbound.port || 0})` : ''}`,
                }))}
              />
            </Form.Item>
          )}

          <Card
            size="small"
            title={
              <Space size={6}>
                <ForkOutlined className="text-primary" />
                <span>{t('pages.nodes.inboundOverrides')}</span>
              </Space>
            }
            className="mb-4 bg-neutral-900/30 border-neutral-700/40"
          >
            <div className="text-xs text-neutral-400 mb-3">
              {t('pages.nodes.inboundOverridesHint')}
            </div>

            <Form.List name="inboundOverrides">
              {(fields, { add, remove }) => (
                <div className="flex flex-col gap-2">
                  {fields.map(({ key, name, ...restField }) => (
                    <Card
                      key={key}
                      size="small"
                      type="inner"
                      className="bg-neutral-800/40 border-neutral-700/40"
                    >
                      <Row gutter={[8, 8]} align="middle">
                        <Col xs={24} sm={11}>
                          <Form.Item
                            shouldUpdate={(prevValues, curValues) =>
                              prevValues.inboundOverrides?.[name]?.targetType !==
                                curValues.inboundOverrides?.[name]?.targetType ||
                              prevValues.inboundOverrides?.[name]?.targetValue !==
                                curValues.inboundOverrides?.[name]?.targetValue
                            }
                            noStyle
                          >
                            {() => {
                              const type = form.getFieldValue(['inboundOverrides', name, 'targetType']) || 'inbound';
                              const val = form.getFieldValue(['inboundOverrides', name, 'targetValue']) || '';
                              const currentCompositeValue = val ? `${type}:${val}` : undefined;

                              return (
                                <Select
                                  value={currentCompositeValue}
                                  placeholder={t('pages.nodes.targetValue')}
                                  options={overrideSelectOptions}
                                  showSearch
                                  optionFilterProp="label"
                                  style={{ width: '100%' }}
                                  onChange={(selectedComposite) => {
                                    if (!selectedComposite) return;
                                    const [parsedType, ...rest] = selectedComposite.split(':');
                                    const parsedVal = rest.join(':');
                                    form.setFieldValue(['inboundOverrides', name, 'targetType'], parsedType);
                                    form.setFieldValue(['inboundOverrides', name, 'targetValue'], parsedVal);
                                  }}
                                />
                              );
                            }}
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={7}>
                          <Form.Item
                            {...restField}
                            name={[name, 'host']}
                            noStyle
                          >
                            <Input placeholder={t('pages.nodes.overrideHost')} />
                          </Form.Item>
                        </Col>
                        <Col xs={18} sm={4}>
                          <Form.Item
                            {...restField}
                            name={[name, 'port']}
                            noStyle
                          >
                            <InputNumber
                              min={1}
                              max={65535}
                              placeholder={t('pages.nodes.overridePort')}
                              style={{ width: '100%' }}
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={6} sm={2} className="text-right">
                          <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => remove(name)}
                          />
                        </Col>
                      </Row>
                    </Card>
                  ))}

                  <Button
                    type="dashed"
                    block
                    icon={<PlusOutlined />}
                    onClick={() =>
                      add({ targetType: 'inbound', targetValue: '', host: '', port: undefined })
                    }
                  >
                    {t('pages.nodes.addOverride')}
                  </Button>
                </div>
              )}
            </Form.List>
          </Card>

          <div className="test-row">
            <Button type="default" loading={testing} onClick={onTest}>
              {t('pages.nodes.testConnection')}
            </Button>
            {testResult && (
              <div className="test-result">
                {testResult.status === 'online' ? (
                  <Alert
                    type="success"
                    showIcon
                    title={t('pages.nodes.connectionOk', { ms: testResult.latencyMs })}
                    description={testResult.xrayVersion ? `Xray ${testResult.xrayVersion}` : undefined}
                  />
                ) : (
                  <Alert
                    type="error"
                    showIcon
                    title={t('pages.nodes.connectionFailed')}
                    description={testResult.error}
                  />
                )}
              </div>
            )}
          </div>
        </Form>
      </Modal>
    </>
  );
}
