import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Checkbox,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  message,
} from 'antd';
import {
  CloudServerOutlined,
  ReloadOutlined,
  UserOutlined,
} from '@ant-design/icons';

import { ClipboardManager, HttpUtil, IntlUtil } from '@/utils';
import {
  DEFAULT_API_TOKEN_EXPIRY_DAYS,
  apiTokenTimestampMilliseconds,
  buildApiTokenCreatePayload,
  parseApiTokenRows,
  parseCreatedApiToken,
} from './api-token';
import type {
  ApiTokenCreatePayload,
  ApiTokenCreateFormValues,
  ApiTokenRow,
  CreatedApiToken,
} from './api-token';

const TOKEN_LIST_ENDPOINT = '/panel/api/setting/apiTokens';
const TOKEN_CREATE_ENDPOINT = '/panel/api/setting/apiTokens/create';

interface ApiMsg<T = unknown> {
  success?: boolean;
  msg?: string;
  obj?: T;
}

function mutationSet(current: ReadonlySet<number>, id: number, pending: boolean): Set<number> {
  const next = new Set(current);
  if (pending) next.add(id);
  else next.delete(id);
  return next;
}

export default function ApiTokenTab() {
  const { t } = useTranslation();
  const [modal, modalContextHolder] = Modal.useModal();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [tokenForm] = Form.useForm<ApiTokenCreateFormValues>();

  const [apiTokens, setApiTokens] = useState<ApiTokenRow[]>([]);
  const [apiTokensLoading, setApiTokensLoading] = useState(true);
  const [apiTokensError, setApiTokensError] = useState('');
  const [pendingTokenIds, setPendingTokenIds] = useState<Set<number>>(() => new Set());
  const tokenListRequestRef = useRef(0);
  const pendingTokenIdsRef = useRef<Set<number>>(new Set());
  const creatingRef = useRef(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdToken, setCreatedToken] = useState<CreatedApiToken | null>(null);
  const [createdTokenAcknowledged, setCreatedTokenAcknowledged] = useState(false);

  const loadApiTokens = useCallback(async () => {
    const requestId = ++tokenListRequestRef.current;
    setApiTokensLoading(true);
    setApiTokensError('');
    try {
      const msg = await HttpUtil.get<unknown>(TOKEN_LIST_ENDPOINT, undefined, { silent: true });
      if (requestId !== tokenListRequestRef.current) return;
      if (!msg?.success) {
        setApiTokensError(msg?.msg || t('pages.settings.security.apiTokenLoadError'));
        return;
      }
      const rows = parseApiTokenRows(msg.obj);
      if (!rows) {
        setApiTokensError(t('pages.settings.security.apiTokenInvalidResponse'));
        return;
      }
      setApiTokens(rows);
    } finally {
      if (requestId === tokenListRequestRef.current) setApiTokensLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadApiTokens();
  }, [loadApiTokens]);

  function openCreateModal() {
    tokenForm.resetFields();
    tokenForm.setFieldsValue({
      name: '',
      kind: 'service',
      expiryDays: DEFAULT_API_TOKEN_EXPIRY_DAYS,
      serviceAcknowledged: false,
    });
    setCreateOpen(true);
  }

  function closeCreateModal() {
    if (creating) return;
    setCreateOpen(false);
    tokenForm.resetFields();
  }

  function payloadErrorMessage(error: unknown): string {
    const code = error instanceof Error ? error.message : '';
    const keyByCode: Record<string, string> = {
      'name-required': 'pages.settings.security.apiTokenNameRequired',
      'name-too-long': 'pages.settings.security.apiTokenNameTooLong',
      'service-ack-required': 'pages.settings.security.apiTokenServiceAcknowledgementRequired',
    };
    return t(keyByCode[code] || 'pages.settings.security.apiTokenFormInvalid');
  }

  async function createApiToken(values: ApiTokenCreateFormValues) {
    if (creatingRef.current) return;
    let payload: ApiTokenCreatePayload;
    try {
      payload = buildApiTokenCreatePayload(values);
    } catch (error) {
      messageApi.error(payloadErrorMessage(error));
      return;
    }

    creatingRef.current = true;
    setCreating(true);
    try {
      const msg = await HttpUtil.post<unknown>(TOKEN_CREATE_ENDPOINT, payload, { silentSuccess: true });
      if (!msg?.success) return;
      const created = parseCreatedApiToken(msg.obj);
      // A successful create mutates server state even if its response is
      // malformed. Always refresh so the owner can immediately revoke that row.
      void loadApiTokens();
      if (!created) {
        messageApi.error(t('pages.settings.security.apiTokenCreateInvalidResponse'));
        return;
      }

      setCreatedToken(created);
      setCreatedTokenAcknowledged(false);
      setCreateOpen(false);
      tokenForm.resetFields();
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  }

  async function copyToken(token: string) {
    const copied = await ClipboardManager.copyText(token);
    if (copied) messageApi.success(t('copySuccess'));
    else messageApi.error(t('pages.settings.security.apiTokenCopyFailed'));
  }

  function confirmDeleteToken(row: ApiTokenRow) {
    modal.confirm({
      title: `${t('delete')} “${row.name}”?`,
      content: t('pages.settings.security.apiTokenDeleteWarning'),
      okText: t('delete'),
      cancelText: t('cancel'),
      okType: 'danger',
      onOk: async () => {
        const msg = await HttpUtil.post(`/panel/api/setting/apiTokens/delete/${row.id}`, undefined, {
          silentSuccess: true,
        }) as ApiMsg;
        if (msg?.success) {
          setApiTokens((current) => current.filter((token) => token.id !== row.id));
        }
      },
    });
  }

  async function toggleTokenEnabled(row: ApiTokenRow) {
    if (pendingTokenIdsRef.current.has(row.id) || row.expired) return;
    const enabled = !row.enabled;
    pendingTokenIdsRef.current = mutationSet(pendingTokenIdsRef.current, row.id, true);
    setPendingTokenIds(new Set(pendingTokenIdsRef.current));
    try {
      const msg = await HttpUtil.post(`/panel/api/setting/apiTokens/setEnabled/${row.id}`, { enabled }, {
        silentSuccess: true,
      }) as ApiMsg;
      if (msg?.success) {
        setApiTokens((current) => current.map((token) => (
          token.id === row.id ? { ...token, enabled } : token
        )));
      }
    } finally {
      pendingTokenIdsRef.current = mutationSet(pendingTokenIdsRef.current, row.id, false);
      setPendingTokenIds(new Set(pendingTokenIdsRef.current));
    }
  }

  function formatTokenDate(timestamp: number): string {
    if (!timestamp) return '';
    return IntlUtil.formatDate(apiTokenTimestampMilliseconds(timestamp));
  }

  function scopeLabel(scope: string): string {
    if (scope === 'clients:read') return t('pages.settings.security.apiTokenScopeClientsRead');
    if (scope === 'clients:create') return t('pages.settings.security.apiTokenScopeClientsCreate');
    if (scope === 'custom-panel:manage') {
      return t('pages.settings.security.apiTokenScopeCustomPanelManage', { defaultValue: 'Custom panel bot' });
    }
    if (scope === '*') return t('pages.settings.security.apiTokenScopeFullAccess');
    return scope;
  }

  function renderTokenSubject(row: ApiTokenRow) {
    if (row.kind === 'service') {
      return (
        <span className="api-token-subject">
          <CloudServerOutlined /> {t('pages.settings.security.apiTokenServiceCredential')}
        </span>
      );
    }
    if (!row.subjectUsername) {
      return (
        <Tag color="error">
          {t('pages.settings.security.apiTokenSubjectUnavailable', { id: row.subjectAdminId ?? '?' })}
        </Tag>
      );
    }
    return (
      <span className="api-token-subject">
        <UserOutlined /> {row.subjectUsername}
        {row.subjectRoleName && <Tag>{row.subjectRoleName}</Tag>}
      </span>
    );
  }

  return (
    <div className="api-token-section">
      {messageContextHolder}
      {modalContextHolder}

      <div className="api-token-header">
        <div className="api-token-header-copy">
          <strong>{t('pages.settings.security.apiTokenManagementTitle')}</strong>
          <p className="api-token-hint">{t('pages.settings.security.apiTokenManagementHint')}</p>
        </div>
        <Space>
          <Button
            size="small"
            icon={<ReloadOutlined />}
            loading={apiTokensLoading}
            onClick={() => void loadApiTokens()}
          >
            {t('refresh')}
          </Button>
          <Button type="primary" size="small" onClick={openCreateModal}>
            + {t('pages.settings.security.apiTokenNew')}
          </Button>
        </Space>
      </div>

      {apiTokensError && (
        <Alert
          type="error"
          showIcon
          title={apiTokensError}
          action={(
            <Button size="small" onClick={() => void loadApiTokens()}>
              {t('pages.settings.security.apiTokenRetry')}
            </Button>
          )}
        />
      )}

      <Spin spinning={apiTokensLoading}>
        {!apiTokens.length && !apiTokensLoading && !apiTokensError && (
          <Empty description={t('pages.settings.security.apiTokenEmpty')} />
        )}

        <div className="api-token-list">
          {apiTokens.map((row) => (
            <div
              key={row.id}
              className={`api-token-row${row.enabled && !row.expired ? '' : ' disabled'}`}
            >
              <div className="api-token-row-head">
                <div className="api-token-name-wrap">
                  <Space size={6} wrap>
                    <span className="api-token-name">{row.name}</span>
                    <Tag color={row.kind === 'delegated' ? 'blue' : 'orange'}>
                      {row.kind === 'delegated'
                        ? t('pages.settings.security.apiTokenKindDelegated')
                        : t('pages.settings.security.apiTokenKindService')}
                    </Tag>
                    {row.expired && (
                      <Tag color="error">{t('pages.settings.security.apiTokenExpired')}</Tag>
                    )}
                    {!row.expired && !row.enabled && (
                      <Tag>{t('pages.settings.security.apiTokenDisabled')}</Tag>
                    )}
                  </Space>
                  <span className="api-token-created">
                    {t('pages.settings.security.apiTokenCreatedAt', { date: formatTokenDate(row.createdAt) })}
                  </span>
                </div>
                <div className="api-token-actions">
                  <Switch
                    size="small"
                    checked={row.enabled}
                    disabled={row.expired}
                    loading={pendingTokenIds.has(row.id)}
                    aria-label={t('pages.settings.security.apiTokenEnabledLabel', { name: row.name })}
                    onChange={() => void toggleTokenEnabled(row)}
                  />
                  <Button
                    size="small"
                    danger
                    type="text"
                    disabled={pendingTokenIds.has(row.id)}
                    onClick={() => confirmDeleteToken(row)}
                  >
                    {t('delete')}
                  </Button>
                </div>
              </div>

              <div className="api-token-details">
                {renderTokenSubject(row)}
                <span className="api-token-expiry">
                  {row.expiresAt > 0
                    ? t('pages.settings.security.apiTokenExpiresAt', { date: formatTokenDate(row.expiresAt) })
                    : t('pages.settings.security.apiTokenNeverExpires')}
                </span>
              </div>

              <div className="api-token-scopes">
                {row.scopes.map((scope) => (
                  <Tag key={scope} color={scope === '*' ? 'red' : 'default'}>
                    {scopeLabel(scope)}
                  </Tag>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Spin>

      <Modal
        open={createOpen}
        title={t('pages.settings.security.apiTokenNew')}
        confirmLoading={creating}
        okText={t('pages.settings.security.apiTokenCreate')}
        cancelText={t('cancel')}
        closable={!creating}
        keyboard={!creating}
        mask={{ closable: !creating }}
        destroyOnHidden
        onOk={() => tokenForm.submit()}
        onCancel={closeCreateModal}
      >
        <Form<ApiTokenCreateFormValues>
          form={tokenForm}
          layout="vertical"
          requiredMark="optional"
          onFinish={(values) => void createApiToken(values)}
        >
          <Form.Item
            name="name"
            label={t('pages.settings.security.apiTokenName')}
            rules={[
              { required: true, whitespace: true, message: t('pages.settings.security.apiTokenNameRequired') },
              { max: 64, message: t('pages.settings.security.apiTokenNameTooLong') },
            ]}
          >
            <Input
              maxLength={64}
              autoComplete="off"
              placeholder={t('pages.settings.security.apiTokenNamePlaceholder')}
            />
          </Form.Item>

          <Form.Item name="kind" initialValue="service" hidden>
            <Input />
          </Form.Item>

          <Alert
            type="error"
            showIcon
            className="api-token-form-alert"
            title={t('pages.settings.security.apiTokenServiceWarningTitle')}
            description={t('pages.settings.security.apiTokenServiceWarning')}
          />

          <Form.Item
            name="serviceAcknowledged"
            valuePropName="checked"
            rules={[{
              validator: (_, checked: boolean | undefined) => (
                checked
                  ? Promise.resolve()
                  : Promise.reject(new Error(
                    t('pages.settings.security.apiTokenServiceAcknowledgementRequired'),
                  ))
              ),
            }]}
          >
            <Checkbox>
              {t('pages.settings.security.apiTokenServiceAcknowledgement')}
            </Checkbox>
          </Form.Item>

          <Form.Item
            name="expiryDays"
            label={t('pages.settings.security.apiTokenExpiry')}
            extra={t('pages.settings.security.apiTokenExpiryHint')}
            rules={[{ required: true }]}
          >
            <Select options={[
              { value: 30, label: t('pages.settings.security.apiTokenExpiryDays', { count: 30 }) },
              { value: 90, label: t('pages.settings.security.apiTokenExpiryDays', { count: 90 }) },
              { value: 180, label: t('pages.settings.security.apiTokenExpiryDays', { count: 180 }) },
              { value: 365, label: t('pages.settings.security.apiTokenExpiryDays', { count: 365 }) },
              { value: 0, label: t('pages.settings.security.apiTokenNeverExpires') },
            ]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={!!createdToken}
        title={t('pages.settings.security.apiTokenCreatedTitle')}
        okText={t('done')}
        closable={false}
        keyboard={false}
        mask={{ closable: false }}
        cancelButtonProps={{ style: { display: 'none' } }}
        okButtonProps={{ disabled: !createdTokenAcknowledged }}
        destroyOnHidden
        onOk={() => setCreatedToken(null)}
      >
        <Alert
          type="warning"
          showIcon
          className="api-token-form-alert"
          title={t('pages.settings.security.apiTokenCreatedNotice')}
        />
        <div className="api-token-value-wrap">
          <code className="api-token-value" aria-label={t('pages.settings.security.apiTokenValue')}>
            {createdToken?.token}
          </code>
          <Button
            size="small"
            type="primary"
            onClick={() => createdToken && void copyToken(createdToken.token)}
          >
            {t('copy')}
          </Button>
        </div>
        <Checkbox
          className="api-token-save-acknowledgement"
          checked={createdTokenAcknowledged}
          onChange={(event) => setCreatedTokenAcknowledged(event.target.checked)}
        >
          {t('pages.settings.security.apiTokenSavedAcknowledgement')}
        </Checkbox>
      </Modal>
    </div>
  );
}
