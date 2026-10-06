import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AutoComplete,
  Button,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import { DeleteOutlined, EyeOutlined, PlusOutlined, ReloadOutlined, RetweetOutlined, CopyOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { ClipboardManager, HttpUtil, IntlUtil, RandomUtil, Wireguard } from '@/utils';
import { formatInboundLabel } from '@/lib/inbounds/label';
import { normalizeClientIps, type ClientIpInfo } from '@/lib/clients/ip-log';
import { DateTimePicker, SelectAllClearButtons } from '@/components/form';
import { TLS_FLOW_CONTROL } from '@/schemas/primitives';
import type { ClientRecord, InboundOption, ExternalLink, ExternalLinkInput } from '@/hooks/useClients';
import { useFail2banStatusQuery, getLimitIpNotice } from '@/api/queries/useFail2banStatusQuery';
import { ClientFormSchema, ClientCreateFormSchema } from '@/schemas/client';
import { useClientHwids } from '@/hooks/useClientHwids';
import { useDatepicker } from '@/hooks/useDatepicker';
import ClientHwidListModal from '@/components/clients/ClientHwidList';
import { getSpeedTranslations } from '@/utils/speedI18n';
import './ClientFormModal.css';

const FLOW_OPTIONS = Object.values(TLS_FLOW_CONTROL);
const VMESS_SECURITY_OPTIONS = ['auto', 'aes-128-gcm', 'chacha20-poly1305', 'none', 'zero'] as const;

const MULTI_CLIENT_PROTOCOLS = new Set([
  'shadowsocks', 'vless', 'vmess', 'trojan', 'hysteria', 'wireguard',
]);

const CLIENT_FORM_MODAL_Z_INDEX = 1000;
const CLIENT_IP_LOG_MODAL_Z_INDEX = CLIENT_FORM_MODAL_Z_INDEX + 1;

interface PresetItem {
  label?: string;
  value: number;
}

const PresetChips: React.FC<{
  items: PresetItem[];
  selectedValue?: number;
  onSelect: (val: number) => void;
}> = ({ items, selectedValue, onSelect }) => {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4, alignItems: 'center' }}>
      {items.map((it) => {
        const isSelected = selectedValue !== undefined && selectedValue === it.value;
        return (
          <button
            key={`${it.label}-${it.value}`}
            type="button"
            onClick={() => onSelect(it.value)}
            style={{
              cursor: 'pointer',
              padding: '1px 6px',
              fontSize: '11px',
              lineHeight: '16px',
              fontWeight: 500,
              borderRadius: '4px',
              border: isSelected
                ? '1px solid var(--ant-color-primary, #1677ff)'
                : '1px solid rgba(140, 155, 175, 0.25)',
              backgroundColor: isSelected
                ? 'rgba(22, 119, 255, 0.18)'
                : 'rgba(140, 155, 175, 0.08)',
              color: isSelected
                ? 'var(--ant-color-primary, #1677ff)'
                : 'var(--ant-color-text-secondary, #94a3b8)',
              transition: 'all 0.15s ease',
              outline: 'none',
              userSelect: 'none',
            }}
          >
            {it.label ?? it.value}
          </button>
        );
      })}
    </div>
  );
};

// One editable row in the Links tab. `key` is a stable client-side id for React.
interface ExternalLinkRow {
  key: number;
  kind: 'link' | 'subscription';
  value: string;
}

interface ApiMsg<T = unknown> {
  success?: boolean;
  msg?: string;
  obj?: T;
}

type Mode = 'add' | 'edit';

interface SaveMetaEdit {
  isEdit: true;
  email: string;
  attach: number[];
  detach: number[];
  externalLinks: ExternalLinkInput[];
}

interface SaveMetaCreate {
  isEdit: false;
  email: string;
  externalLinks: ExternalLinkInput[];
}

interface SaveCreatePayload {
  client: Record<string, unknown>;
  inboundIds: number[];
}

interface ClientFormModalProps {
  open: boolean;
  mode: Mode;
  client: ClientRecord | null;
  inbounds: InboundOption[];
  adminInbounds?: number[];
  attachedExternalLinks?: ExternalLink[];
  attachedIds?: number[];
  tgBotEnable?: boolean;
  groups?: string[];
  save: (
    payload: Record<string, unknown> | SaveCreatePayload,
    meta: SaveMetaEdit | SaveMetaCreate,
  ) => Promise<ApiMsg | null>;
  resetTraffic?: (client: ClientRecord) => Promise<ApiMsg | null>;
  onOpenChange: (open: boolean) => void;
}

interface FormState {
  email: string;
  subId: string;
  uuid: string;
  password: string;
  auth: string;
  flow: string;
  security: string;
  reverseTag: string;
  totalGB: number;
  uploadLimit: number;
  downloadLimit: number;
  expiryDate: Dayjs | null;
  delayedStart: boolean;
  delayedDays: number;
  reset: number;
  resetLimit: number;
  limitIp: number;
  limitHwid: number;
  tgId: number;
  group: string;
  comment: string;
  enable: boolean;
  inboundIds: number[];
  externalLinks: ExternalLinkRow[];
  wgPrivateKey: string;
  wgPublicKey: string;
  wgPreSharedKey: string;
  wgAllowedIPs: string;
}

function emptyForm(): FormState {
  return {
    email: '',
    subId: '',
    uuid: '',
    password: '',
    auth: '',
    flow: '',
    security: 'auto',
    reverseTag: '',
    totalGB: 0,
    uploadLimit: 0,
    downloadLimit: 0,
    expiryDate: null,
    delayedStart: false,
    delayedDays: 0,
    reset: 0,
    resetLimit: 0,
    limitIp: 0,
    limitHwid: 0,
    tgId: 0,
    group: '',
    comment: '',
    enable: true,
    inboundIds: [],
    externalLinks: [],
    wgPrivateKey: '',
    wgPublicKey: '',
    wgPreSharedKey: '',
    wgAllowedIPs: '',
  };
}

let externalLinkRowSeq = 0;
function toExternalLinkRows(links: ExternalLink[] | undefined): ExternalLinkRow[] {
  return (links || []).map((l) => ({
    key: (externalLinkRowSeq += 1),
    kind: l.kind === 'subscription' ? 'subscription' : 'link',
    value: l.value || '',
  }));
}

function bytesToGB(bytes: number): number {
  if (!bytes || bytes <= 0) return 0;
  return Math.round((bytes / (1024 * 1024 * 1024)) * 100) / 100;
}

function gbToBytes(gb: number): number {
  if (!gb || gb <= 0) return 0;
  return Math.round(gb * 1024 * 1024 * 1024);
}

export default function ClientFormModal({
  open,
  mode,
  client,
  inbounds,
  adminInbounds = [],
  attachedExternalLinks = [],
  attachedIds = [],
  tgBotEnable: _tgBotEnable = false,
  groups = [],
  save,
  resetTraffic,
  onOpenChange,
}: ClientFormModalProps) {
  const { t, i18n } = useTranslation();
  const { datepicker } = useDatepicker();
  const speedDict = useMemo(() => getSpeedTranslations(i18n.language), [i18n.language]);
  const [messageApi, messageContextHolder] = message.useMessage();
  const isEdit = mode === 'edit';

  const isReseller = useMemo(() => {
    return (typeof window !== 'undefined' && typeof window.X_UI_BASE_PATH !== 'undefined')
      ? !!window.X_UI_IS_RESELLER
      : !!localStorage.getItem('daltoon_current_admin');
  }, []);

  const currentAdmin = useMemo(() => {
    const raw = localStorage.getItem('daltoon_current_admin');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, []);

  const effectiveInboundIds = useMemo(() => {
    if (isReseller) {
      if (currentAdmin?.inbounds && currentAdmin.inbounds.length > 0) {
        return currentAdmin.inbounds;
      }
      return (inbounds || []).map((ib) => ib.id);
    }
    if (adminInbounds && adminInbounds.length > 0) {
      return adminInbounds;
    }
    return null;
  }, [isReseller, currentAdmin, adminInbounds, inbounds]);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [clientIps, setClientIps] = useState<ClientIpInfo[]>([]);
  const [ipsLoading, setIpsLoading] = useState(false);
  const [ipsClearing, setIpsClearing] = useState(false);
  const [ipsModalOpen, setIpsModalOpen] = useState(false);
  const [hwidsModalOpen, setHwidsModalOpen] = useState(false);

  const fail2ban = useFail2banStatusQuery();
  const limitIpDisabled = !fail2ban.usable;
  const limitIpNotice = getLimitIpNotice(fail2ban, t);

  const {
    clientHwids,
    hwidsLoading,
    hwidsClearing,
    deletingHwidId,
    loadHwids,
    clearHwids,
    deleteHwid,
  } = useClientHwids(isEdit && client?.email ? client.email : undefined);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addExternalLinkRow(kind: 'link' | 'subscription', initialValue = '') {
    setForm((prev) => ({
      ...prev,
      externalLinks: [...prev.externalLinks, { key: (externalLinkRowSeq += 1), kind, value: initialValue }],
    }));
  }

  function updateExternalLinkRow(key: number, value: string) {
    setForm((prev) => ({
      ...prev,
      externalLinks: prev.externalLinks.map((r) => (r.key === key ? { ...r, value } : r)),
    }));
  }

  function removeExternalLinkRow(key: number) {
    setForm((prev) => ({
      ...prev,
      externalLinks: prev.externalLinks.filter((r) => r.key !== key),
    }));
  }

  useEffect(() => {
    if (!open) return;
    setIpsModalOpen(false);
    setHwidsModalOpen(false);

    if (isEdit && client) {
      const et = Number(client.expiryTime) || 0;
      const next: FormState = {
        ...emptyForm(),
        email: client.email || '',
        subId: client.subId || '',
        uuid: client.uuid || '',
        password: client.password || '',
        auth: client.auth || '',
        flow: client.flow || '',
        security: client.security || 'auto',
        reverseTag: (typeof client.reverse === 'object' && client.reverse !== null ? client.reverse.tag : (typeof client.reverse === 'string' ? client.reverse : '')) || '',
        totalGB: bytesToGB(client.totalGB || 0),
        uploadLimit: client.uploadLimit || client.uploadMbps || 0,
        downloadLimit: client.downloadLimit || client.downloadMbps || 0,
        reset: Number(client.reset) || 0,
        resetLimit: Number(client.resetLimit) || 0,
        limitIp: client.limitIp || 0,
        limitHwid: Number(client.limitHwid) || 0,
        tgId: Number(client.tgId) || 0,
        group: client.group || '',
        comment: client.comment || '',
        enable: !!client.enable,
        inboundIds: Array.isArray(attachedIds) ? [...attachedIds] : [],
        externalLinks: toExternalLinkRows(attachedExternalLinks),
        wgPrivateKey: client.privateKey || '',
        wgPublicKey: client.publicKey || '',
        wgPreSharedKey: client.preSharedKey || '',
        wgAllowedIPs: Array.isArray(client.allowedIPs) ? (client.allowedIPs as string[]).join(',') : (client.allowedIPs || ''),
      };
      if (et < 0) {
        next.delayedStart = true;
        next.delayedDays = Math.round(et / -86400000);
        next.expiryDate = null;
      } else {
        next.delayedStart = false;
        next.delayedDays = 0;
        next.expiryDate = et > 0 ? dayjs(et) : null;
      }
      setForm(next);
      void loadIps();
      void loadHwids();
    } else {
      const wgKeypair = Wireguard.generateKeypair();
      const defaultInboundIds = (Array.isArray(attachedIds) && attachedIds.length > 0)
        ? [...attachedIds]
        : (isReseller
            ? (effectiveInboundIds && effectiveInboundIds.length > 0
                ? [...effectiveInboundIds]
                : (inbounds || []).map((ib) => ib.id))
            : []);
      setForm({
        ...emptyForm(),
        email: RandomUtil.randomLowerAndNum(10),
        uuid: RandomUtil.randomUUID(),
        subId: RandomUtil.randomLowerAndNum(16),
        password: RandomUtil.randomLowerAndNum(16),
        auth: RandomUtil.randomLowerAndNum(16),
        wgPrivateKey: wgKeypair.privateKey,
        wgPublicKey: wgKeypair.publicKey,
        inboundIds: defaultInboundIds,
      });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, client]);

  const vlessLikeIds = useMemo(() => {
    const ids = new Set<number>();
    for (const row of inbounds || []) {
      if (row && row.protocol === 'vless') ids.add(row.id);
    }
    return ids;
  }, [inbounds]);

  const vmessIds = useMemo(() => {
    const ids = new Set<number>();
    for (const row of inbounds || []) {
      if (row && row.protocol === 'vmess') ids.add(row.id);
    }
    return ids;
  }, [inbounds]);

  const wireguardIds = useMemo(() => {
    const ids = new Set<number>();
    for (const row of inbounds || []) {
      if (row && row.protocol === 'wireguard') ids.add(row.id);
    }
    return ids;
  }, [inbounds]);

  const ss2022Method = useMemo(() => {
    for (const id of form.inboundIds || []) {
      const ib = (inbounds || []).find((row) => row.id === id);
      const method = ib?.ssMethod;
      if (method && method.substring(0, 4) === '2022') return method;
    }
    return '';
  }, [form.inboundIds, inbounds]);

  function regeneratePassword() {
    update('password', ss2022Method
      ? RandomUtil.randomShadowsocksPassword(ss2022Method)
      : RandomUtil.randomLowerAndNum(16));
  }

  const showFlow = useMemo(
    () => (form.inboundIds || []).some((id) => vlessLikeIds.has(id)),
    [form.inboundIds, vlessLikeIds],
  );

  const showReverseTag = useMemo(
    () => (form.inboundIds || []).some((id) => vlessLikeIds.has(id)),
    [form.inboundIds, vlessLikeIds],
  );

  const showSecurity = useMemo(
    () => (form.inboundIds || []).some((id) => vmessIds.has(id)),
    [form.inboundIds, vmessIds],
  );

  const showWireguard = useMemo(
    () => (form.inboundIds || []).some((id) => wireguardIds.has(id)),
    [form.inboundIds, wireguardIds],
  );

  function regenerateWireguardKeys() {
    const kp = Wireguard.generateKeypair();
    setForm((prev) => ({ ...prev, wgPrivateKey: kp.privateKey, wgPublicKey: kp.publicKey }));
  }

  function generateWireguardPresharedKey() {
    update('wgPreSharedKey', Wireguard.keyToBase64(Wireguard.generatePresharedKey()));
  }

  useEffect(() => {
    if (!showFlow && form.flow) {

      update('flow', '');
    }
  }, [showFlow, form.flow]);

  useEffect(() => {
    if (!showReverseTag && form.reverseTag) {

      update('reverseTag', '');
    }
  }, [showReverseTag, form.reverseTag]);

  useEffect(() => {
    if (!ss2022Method) return;
    setForm((prev) => (
      RandomUtil.isShadowsocks2022Password(prev.password, ss2022Method)
        ? prev
        : { ...prev, password: RandomUtil.randomShadowsocksPassword(ss2022Method) }
    ));
  }, [ss2022Method]);

  const inboundOptions = useMemo(
    () => (inbounds || [])
      .filter((ib) => MULTI_CLIENT_PROTOCOLS.has(ib.protocol || ''))
      .map((ib) => ({
        label: formatInboundLabel(ib.tag, ib.remark),
        value: ib.id,
        title: formatInboundLabel(ib.tag, ib.remark),
      })),
    [inbounds],
  );

  const linkRows = useMemo(() => form.externalLinks.filter((r) => r.kind === 'link'), [form.externalLinks]);
  const subscriptionRows = useMemo(() => form.externalLinks.filter((r) => r.kind === 'subscription'), [form.externalLinks]);

  async function loadIps() {
    if (!isEdit || !client?.email) return;
    setIpsLoading(true);
    try {
      const msg = await HttpUtil.post(`/panel/api/clients/ips/${encodeURIComponent(client.email)}`) as ApiMsg<unknown[]>;
      if (!msg?.success) { setClientIps([]); return; }
      setClientIps(normalizeClientIps(msg.obj));
    } finally {
      setIpsLoading(false);
    }
  }

  function openIpsModal() {
    setIpsModalOpen(true);
    if (clientIps.length === 0) void loadIps();
  }

  async function clearIps() {
    if (!isEdit || !client?.email) return;
    setIpsClearing(true);
    try {
      const msg = await HttpUtil.post(`/panel/api/clients/clearIps/${encodeURIComponent(client.email)}`) as ApiMsg;
      if (msg?.success) setClientIps([]);
    } finally {
      setIpsClearing(false);
    }
  }

  function close() {
    onOpenChange(false);
  }

  async function onResetTraffic() {
    if (!isEdit || !client?.email || !resetTraffic) return;
    setResetting(true);
    try {
      const msg = await resetTraffic(client);
      if (msg?.success) {
        messageApi.success(t('pages.clients.toasts.trafficReset'));
      } else {
        messageApi.error(msg?.msg || t('somethingWentWrong'));
      }
    } finally {
      setResetting(false);
    }
  }

  async function onSubmit() {
    let finalInboundIds = form.inboundIds;
    if (isReseller && (!finalInboundIds || finalInboundIds.length === 0)) {
      finalInboundIds = (effectiveInboundIds && effectiveInboundIds.length > 0)
        ? effectiveInboundIds
        : (inbounds || []).map((ib) => ib.id);
    } else if (!finalInboundIds || finalInboundIds.length === 0) {
      if (effectiveInboundIds && effectiveInboundIds.length > 0) {
        finalInboundIds = effectiveInboundIds;
      }
    }
    const schema = isEdit ? ClientFormSchema : (isReseller ? ClientFormSchema : ClientCreateFormSchema);
    const validated = schema.safeParse({
      email: form.email,
      subId: form.subId,
      uuid: form.uuid,
      password: form.password,
      auth: form.auth,
      flow: form.flow,
      security: form.security,
      reverseTag: form.reverseTag,
      totalGB: form.totalGB,
      delayedStart: form.delayedStart,
      delayedDays: form.delayedDays,
      reset: form.reset,
      limitIp: form.limitIp,
      tgId: form.tgId,
      group: form.group,
      comment: form.comment,
      enable: form.enable,
      inboundIds: finalInboundIds,
    });
    if (!validated.success) {
      const issue = validated.error.issues[0];
      messageApi.error(t(issue?.message ?? 'somethingWentWrong'));
      return;
    }
    const expiryTime = form.delayedStart
      ? -86400000 * (Number(form.delayedDays) || 0)
      : (form.expiryDate ? form.expiryDate.valueOf() : 0);
    const clientPayload: Record<string, unknown> = {
      email: form.email.trim(),
      subId: form.subId,
      id: form.uuid,
      password: form.password,
      auth: form.auth,
      flow: showFlow ? (form.flow || '') : '',
      security: showSecurity ? (form.security || 'auto') : 'auto',
      totalGB: gbToBytes(form.totalGB),
      uploadLimit: Number(form.uploadLimit) || 0,
      downloadLimit: Number(form.downloadLimit) || 0,
      uploadMbps: Number(form.uploadLimit) || 0,
      downloadMbps: Number(form.downloadLimit) || 0,
      expiryTime,
      reset: Number(form.reset) || 0,
      resetLimit: Number(form.resetLimit) || 0,
      limitIp: Number(form.limitIp) || 0,
      limitHwid: Number(form.limitHwid) || 0,
      tgId: Number(form.tgId) || 0,
      group: form.group,
      comment: form.comment,
      enable: !!form.enable,
    };
    const reverseTag = showReverseTag ? (form.reverseTag || '').trim() : '';
    if (reverseTag) {
      clientPayload.reverse = { tag: reverseTag };
    }

    if (showWireguard) {
      clientPayload.privateKey = form.wgPrivateKey;
      clientPayload.publicKey = form.wgPublicKey;
      if (form.wgPreSharedKey) {
        clientPayload.preSharedKey = form.wgPreSharedKey;
      }
      const allowedIPs = (typeof form.wgAllowedIPs === 'string' ? form.wgAllowedIPs : '')
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s !== '');
      if (allowedIPs.length > 0) {
        clientPayload.allowedIPs = allowedIPs;
      }
    }

    const externalLinks: ExternalLinkInput[] = form.externalLinks
      .map((r) => ({ kind: r.kind, value: r.value.trim(), remark: '' }))
      .filter((r) => r.value !== '');

    setSubmitting(true);
    try {
      let msg;
      if (isEdit && client) {
        const original = new Set(attachedIds || []);
        const next = new Set(finalInboundIds || []);
        const toAttach = [...next].filter((id) => !original.has(id));
        const toDetach = [...original].filter((id) => !next.has(id));
        msg = await save(clientPayload, {
          isEdit: true,
          email: client.email,
          attach: toAttach,
          detach: toDetach,
          externalLinks,
        });
      } else {
        msg = await save(
          { client: clientPayload, inboundIds: finalInboundIds },
          { isEdit: false, email: clientPayload.email as string, externalLinks },
        );
      }
      if (msg?.success) close();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {messageContextHolder}
      <Modal
        open={open}
        title={isEdit ? t('pages.clients.editClient') : t('pages.clients.addClient')}
        destroyOnHidden
        className="client-form-modal"
        width={720}
        zIndex={CLIENT_FORM_MODAL_Z_INDEX}
        style={{ top: 20 }}
        styles={{ body: { maxHeight: 'calc(100vh - 160px)', overflowY: 'auto', overflowX: 'hidden' } }}
        onCancel={close}
        footer={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isEdit && resetTraffic && (
              <Popconfirm
                title={t('pages.inbounds.resetTraffic')}
                description={t('pages.inbounds.resetTrafficContent')}
                okText={t('reset')}
                cancelText={t('cancel')}
                zIndex={CLIENT_IP_LOG_MODAL_Z_INDEX}
                onConfirm={onResetTraffic}
              >
                <Button color="danger" variant="filled" icon={<RetweetOutlined />} loading={resetting}>
                  {t('pages.inbounds.resetTraffic')}
                </Button>
              </Popconfirm>
            )}
            <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 8 }}>
              <Button onClick={close}>{t('cancel')}</Button>
              <Button type="primary" loading={submitting} onClick={onSubmit}>
                {isEdit ? t('save') : t('create')}
              </Button>
            </div>
          </div>
        }
      >
        <Form layout="vertical">
          <Tabs
            defaultActiveKey="basic"
            items={[
              {
                key: 'basic',
                label: t('pages.clients.tabBasics'),
                children: (
                  <>
                    <Row gutter={16}>
                      <Col xs={24} sm={8}>
                        <Form.Item label={t('pages.clients.email')} required>
                          <Space.Compact style={{ display: 'flex' }}>
                            <Input
                              value={form.email}
                              placeholder={t('pages.clients.email')}
                              style={{ flex: 1 }}
                              onChange={(e) => update('email', e.target.value)}
                            />
                            {!isEdit && (
                              <Button aria-label={t('regenerate')} icon={<ReloadOutlined />} onClick={() => update('email', RandomUtil.randomLowerAndNum(10))} />
                            )}
                          </Space.Compact>
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={8}>
                        <Form.Item label={t('pages.clients.totalGB')} tooltip={t('pages.clients.totalGBDesc')}>
                          <InputNumber
                            value={form.totalGB}
                            min={0}
                            step={1}
                            style={{ width: '100%' }}
                            onChange={(v) => update('totalGB', Number(v) || 0)}
                          />
                          <PresetChips
                            items={[
                              { label: '0', value: 0 },
                              { label: '10G', value: 10 },
                              { label: '20G', value: 20 },
                              { label: '30G', value: 30 },
                              { label: '50G', value: 50 },
                              { label: '80G', value: 80 },
                              { label: '100G', value: 100 },
                              { label: '200G', value: 200 },
                            ]}
                            selectedValue={form.totalGB}
                            onSelect={(v) => update('totalGB', v)}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={8}>
                        <Form.Item label={t('pages.clients.limitIp')} tooltip={t('pages.clients.limitIpDesc')}>
                          <Tooltip title={limitIpNotice || undefined}>
                            <span style={{ display: 'flex', width: '100%' }}>
                              <Space.Compact style={{ display: 'flex', flex: 1 }}>
                                <InputNumber
                                  value={form.limitIp}
                                  min={0}
                                  disabled={limitIpDisabled}
                                  style={{ flex: 1, ...(limitIpDisabled ? { pointerEvents: 'none' } : null) }}
                                  onChange={(v) => update('limitIp', Number(v) || 0)}
                                />
                                {isEdit && (
                                  <Tooltip title={t('pages.clients.ipLog')}>
                                    <Button aria-label={t('pages.clients.ipLog')} icon={<EyeOutlined />} loading={ipsLoading} onClick={openIpsModal}>
                                      {clientIps.length > 0 ? clientIps.length : ''}
                                    </Button>
                                  </Tooltip>
                                )}
                              </Space.Compact>
                            </span>
                          </Tooltip>
                          {!limitIpDisabled && (
                            <PresetChips
                              items={[
                                { label: '0 (∞)', value: 0 },
                                { label: '1', value: 1 },
                                { label: '2', value: 2 },
                                { label: '3', value: 3 },
                                { label: '4', value: 4 },
                                { label: '5', value: 5 },
                              ]}
                              selectedValue={form.limitIp}
                              onSelect={(v) => update('limitIp', v)}
                            />
                          )}
                        </Form.Item>
                      </Col>
                    </Row>

                    <Row gutter={16}>
                      <Col xs={24} sm={8}>
                        <Form.Item label={speedDict.uploadLimit} tooltip={speedDict.uploadLimitDesc}>
                          <InputNumber
                            value={form.uploadLimit}
                            min={0}
                            step={1}
                            style={{ width: '100%' }}
                            onChange={(v) => update('uploadLimit', Number(v) || 0)}
                          />
                          <PresetChips
                            items={[
                              { label: '0', value: 0 },
                              { label: '5M', value: 5 },
                              { label: '10M', value: 10 },
                              { label: '20M', value: 20 },
                              { label: '50M', value: 50 },
                              { label: '100M', value: 100 },
                            ]}
                            selectedValue={form.uploadLimit}
                            onSelect={(v) => update('uploadLimit', v)}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={8}>
                        <Form.Item label={speedDict.downloadLimit} tooltip={speedDict.downloadLimitDesc}>
                          <InputNumber
                            value={form.downloadLimit}
                            min={0}
                            step={1}
                            style={{ width: '100%' }}
                            onChange={(v) => update('downloadLimit', Number(v) || 0)}
                          />
                          <PresetChips
                            items={[
                              { label: '0', value: 0 },
                              { label: '10M', value: 10 },
                              { label: '20M', value: 20 },
                              { label: '50M', value: 50 },
                              { label: '100M', value: 100 },
                              { label: '200M', value: 200 },
                            ]}
                            selectedValue={form.downloadLimit}
                            onSelect={(v) => update('downloadLimit', v)}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={8}>
                        <Form.Item label={t('pages.clients.limitHwid')} tooltip={t('pages.clients.limitHwidDesc')}>
                          <span style={{ display: 'flex', width: '100%' }}>
                            <Space.Compact style={{ display: 'flex', flex: 1 }}>
                              <InputNumber
                                value={form.limitHwid}
                                min={0}
                                style={{ flex: 1 }}
                                onChange={(v) => update('limitHwid', Number(v) || 0)}
                              />
                              {isEdit && (
                                <Tooltip title={t('pages.clients.hwidLog')}>
                                  <Button aria-label={t('pages.clients.hwidLog')} icon={<EyeOutlined />} loading={hwidsLoading} onClick={() => setHwidsModalOpen(true)}>
                                    {clientHwids.length > 0 ? clientHwids.length : ''}
                                  </Button>
                                </Tooltip>
                              )}
                            </Space.Compact>
                          </span>
                          <PresetChips
                            items={[
                              { label: '0 (∞)', value: 0 },
                              { label: '1', value: 1 },
                              { label: '2', value: 2 },
                              { label: '3', value: 3 },
                              { label: '5', value: 5 },
                            ]}
                            selectedValue={form.limitHwid}
                            onSelect={(v) => update('limitHwid', v)}
                          />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Row gutter={16}>
                      <Col xs={24} sm={12}>
                        {form.delayedStart ? (
                          <Form.Item label={t('pages.clients.expireDays')} tooltip={t('pages.clients.expireDays')}>
                            <InputNumber
                              value={form.delayedDays}
                              min={0}
                              style={{ width: '100%' }}
                              onChange={(v) => update('delayedDays', Number(v) || 0)}
                            />
                            <PresetChips
                              items={[
                                { label: '30d', value: 30 },
                                { label: '60d', value: 60 },
                                { label: '90d', value: 90 },
                                { label: '180d', value: 180 },
                                { label: '365d', value: 365 },
                              ]}
                              selectedValue={form.delayedDays}
                              onSelect={(v) => update('delayedDays', v)}
                            />
                          </Form.Item>
                        ) : (
                          <Form.Item label={t('pages.clients.expiryTime')}>
                            <DateTimePicker
                              value={form.expiryDate}
                              onChange={(d) => update('expiryDate', d || null)}
                            />
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4, alignItems: 'center' }}>
                              {[
                                { label: '+1M', months: 1 },
                                { label: '+2M', months: 2 },
                                { label: '+3M', months: 3 },
                                { label: '+6M', months: 6 },
                                { label: '+1Y', months: 12 },
                              ].map((pm) => (
                                <button
                                  key={pm.months}
                                  type="button"
                                  onClick={() => {
                                    const base = form.expiryDate && form.expiryDate.isAfter(dayjs()) ? form.expiryDate : dayjs();
                                    update('expiryDate', base.add(pm.months, 'month'));
                                  }}
                                  style={{
                                    cursor: 'pointer',
                                    padding: '1px 6px',
                                    fontSize: '11px',
                                    lineHeight: '16px',
                                    fontWeight: 500,
                                    borderRadius: '4px',
                                    border: '1px solid rgba(140, 155, 175, 0.25)',
                                    backgroundColor: 'rgba(140, 155, 175, 0.08)',
                                    color: 'var(--ant-color-text-secondary, #94a3b8)',
                                    transition: 'all 0.15s ease',
                                    outline: 'none',
                                    userSelect: 'none',
                                  }}
                                >
                                  {pm.label}
                                </button>
                              ))}
                              {[30, 60, 90, 180, 365].map((days) => {
                                const isSelected = Boolean(form.expiryDate && Math.abs(form.expiryDate.diff(dayjs(), 'day') - days) <= 1);
                                return (
                                  <button
                                    key={days}
                                    type="button"
                                    onClick={() => update('expiryDate', dayjs().add(days, 'day'))}
                                    style={{
                                      cursor: 'pointer',
                                      padding: '1px 6px',
                                      fontSize: '11px',
                                      lineHeight: '16px',
                                      fontWeight: 500,
                                      borderRadius: '4px',
                                      border: isSelected
                                        ? '1px solid var(--ant-color-primary, #1677ff)'
                                        : '1px solid rgba(140, 155, 175, 0.25)',
                                      backgroundColor: isSelected
                                        ? 'rgba(22, 119, 255, 0.18)'
                                        : 'rgba(140, 155, 175, 0.08)',
                                      color: isSelected
                                        ? 'var(--ant-color-primary, #1677ff)'
                                        : 'var(--ant-color-text-secondary, #94a3b8)',
                                      transition: 'all 0.15s ease',
                                      outline: 'none',
                                      userSelect: 'none',
                                    }}
                                  >
                                    {days}d
                                  </button>
                                );
                              })}
                            </div>
                          </Form.Item>
                        )}
                      </Col>
                      <Col xs={12} sm={6}>
                        <Form.Item label={t('pages.clients.delayedStart')}>
                          <Switch
                            checked={form.delayedStart}
                            onChange={(v) => {
                              update('delayedStart', v);
                              if (v) {
                                update('expiryDate', null);
                              } else {
                                update('delayedDays', 0);
                              }
                            }}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={12} sm={6}>
                        <Form.Item label={t('pages.clients.renewDays')} tooltip={t('pages.clients.renewDesc')}>
                          <InputNumber
                            value={form.reset}
                            min={0}
                            style={{ width: '100%' }}
                            onChange={(v) => update('reset', Number(v) || 0)}
                          />
                          <PresetChips
                            items={[
                              { label: '0', value: 0 },
                              { label: '30d', value: 30 },
                              { label: '60d', value: 60 },
                              { label: '90d', value: 90 },
                            ]}
                            selectedValue={form.reset}
                            onSelect={(v) => update('reset', v)}
                          />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Row gutter={16}>
                      <Col xs={24} sm={8}>
                        <Form.Item label={t('pages.clients.resetDay')} tooltip={t('pages.clients.resetDayDesc')}>
                          <InputNumber
                            value={form.reset}
                            min={0}
                            style={{ width: '100%' }}
                            onChange={(v) => update('reset', Number(v) || 0)}
                          />
                          <PresetChips
                            items={[
                              { label: '0', value: 0 },
                              { label: '1d', value: 1 },
                              { label: '7d', value: 7 },
                              { label: '15d', value: 15 },
                              { label: '30d', value: 30 },
                            ]}
                            selectedValue={form.reset}
                            onSelect={(v) => update('reset', v)}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={8}>
                        <Form.Item label={t('pages.clients.resetLimit')} tooltip={t('pages.clients.resetLimitDesc')}>
                          <InputNumber
                            value={form.resetLimit}
                            min={0}
                            style={{ width: '100%' }}
                            onChange={(v) => update('resetLimit', Number(v) || 0)}
                          />
                          <PresetChips
                            items={[
                              { label: '0 (∞)', value: 0 },
                              { label: '1×', value: 1 },
                              { label: '3×', value: 3 },
                              { label: '6×', value: 6 },
                              { label: '12×', value: 12 },
                            ]}
                            selectedValue={form.resetLimit}
                            onSelect={(v) => update('resetLimit', v)}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={8}>
                        <Form.Item label={t('pages.clients.resetTraffic')} tooltip={t('pages.clients.trafficResetCycleDesc')}>
                          <Select
                            value={form.reset}
                            onChange={(v) => update('reset', Number(v) || 0)}
                            options={[
                              { value: 0, label: t('pages.clients.trafficResetNever') },
                              { value: 1, label: t('pages.clients.trafficResetDaily') },
                              { value: 7, label: t('pages.clients.trafficResetWeekly') },
                              { value: 15, label: t('pages.clients.trafficResetBiweekly') },
                              { value: 30, label: t('pages.clients.trafficResetMonthly') },
                              ...(form.reset !== 0 && form.reset !== 1 && form.reset !== 7 && form.reset !== 15 && form.reset !== 30
                                ? [{ value: form.reset, label: `${form.reset} ${t('pages.clients.days')}` }]
                                : []),
                            ]}
                          />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Row gutter={16}>
                      <Col xs={24} sm={12}>
                        <Form.Item label={t('pages.clients.comment')}>
                          <Input value={form.comment} onChange={(e) => update('comment', e.target.value)} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Form.Item label={t('pages.clients.group')} tooltip={t('pages.clients.groupDesc')}>
                          <AutoComplete
                            value={form.group}
                            placeholder={t('pages.clients.groupPlaceholder')}
                            options={(groups || []).map((g) => ({ value: g }))}
                            onChange={(v) => update('group', v ?? '')}
                            allowClear
                          />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Row gutter={16}>
                      <Col xs={24} sm={12}>
                        <Form.Item label={t('pages.clients.telegramId')}>
                          <InputNumber
                            value={form.tgId}
                            min={0}
                            controls={false}
                            placeholder="0"
                            style={{ width: '100%' }}
                            onChange={(v) => update('tgId', Number(v) || 0)}
                          />
                        </Form.Item>
                      </Col>
                      {showReverseTag && (
                        <Col xs={24} sm={12}>
                          <Form.Item label={t('pages.clients.reverseTag')}>
                            <Input
                              value={form.reverseTag}
                              placeholder={t('pages.clients.reverseTagPlaceholder')}
                              onChange={(e) => update('reverseTag', e.target.value)}
                            />
                          </Form.Item>
                        </Col>
                      )}
                    </Row>

                    {!isReseller && (
                      <Form.Item label={t('pages.clients.attachedInbounds')} required={!isEdit}>
                        <SelectAllClearButtons
                          options={inboundOptions}
                          value={form.inboundIds}
                          onChange={(v) => update('inboundIds', v)}
                        />
                        <Select
                          mode="multiple"
                          value={form.inboundIds}
                          onChange={(v) => update('inboundIds', v)}
                          options={inboundOptions}
                          placeholder={t('pages.clients.selectInbound')}
                          maxTagCount="responsive"
                          placement="topLeft"
                          listHeight={220}
                          showSearch={{
                            filterOption: (input, option) =>
                              ((option?.label as string) || '').toLowerCase().includes(input.toLowerCase()),
                          }}
                        />
                      </Form.Item>
                    )}

                    <Form.Item>
                      <Switch aria-label={t('enable')} checked={form.enable} onChange={(v) => update('enable', v)} />
                      <span style={{ marginInlineStart: 8 }}>{t('enable')}</span>
                    </Form.Item>
                  </>
                ),
              },
              {
                key: 'config',
                label: t('pages.clients.tabCredentials'),
                children: (
                  <>
                    <Row gutter={16}>
                      <Col xs={24} sm={12}>
                        <Form.Item label={speedDict.uploadLimit} tooltip={speedDict.uploadLimitDesc}>
                          <InputNumber
                            value={form.uploadLimit}
                            min={0}
                            step={1}
                            style={{ width: '100%' }}
                            onChange={(v) => update('uploadLimit', Number(v) || 0)}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Form.Item label={speedDict.downloadLimit} tooltip={speedDict.downloadLimitDesc}>
                          <InputNumber
                            value={form.downloadLimit}
                            min={0}
                            step={1}
                            style={{ width: '100%' }}
                            onChange={(v) => update('downloadLimit', Number(v) || 0)}
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item label={t('pages.clients.uuid')}>
                      <Space.Compact style={{ display: 'flex' }}>
                        <Input value={form.uuid} style={{ flex: 1 }} onChange={(e) => update('uuid', e.target.value)} />
                        <Button aria-label={t('regenerate')} icon={<ReloadOutlined />} onClick={() => update('uuid', RandomUtil.randomUUID())} />
                      </Space.Compact>
                    </Form.Item>

                    <Form.Item label={t('pages.clients.password')}>
                      <Space.Compact style={{ display: 'flex' }}>
                        <Input value={form.password} style={{ flex: 1 }} onChange={(e) => update('password', e.target.value)} />
                        <Button aria-label={t('regenerate')} icon={<ReloadOutlined />} onClick={regeneratePassword} />
                      </Space.Compact>
                    </Form.Item>

                    <Form.Item label={t('pages.clients.subId')}>
                      <Space.Compact style={{ display: 'flex' }}>
                        <Input value={form.subId} style={{ flex: 1 }} onChange={(e) => update('subId', e.target.value)} />
                        <Button aria-label={t('regenerate')} icon={<ReloadOutlined />} onClick={() => update('subId', RandomUtil.randomLowerAndNum(16))} />
                      </Space.Compact>
                    </Form.Item>

                    <Form.Item label={t('pages.clients.hysteriaAuth')}>
                      <Space.Compact style={{ display: 'flex' }}>
                        <Input value={form.auth} style={{ flex: 1 }} onChange={(e) => update('auth', e.target.value)} />
                        <Button aria-label={t('regenerate')} icon={<ReloadOutlined />} onClick={() => update('auth', RandomUtil.randomLowerAndNum(16))} />
                      </Space.Compact>
                    </Form.Item>

                    {showFlow && (
                      <Form.Item label={t('pages.clients.flow')}>
                        <Select
                          value={form.flow}
                          onChange={(v) => update('flow', v)}
                          options={[
                            { value: '', label: t('none') },
                            ...FLOW_OPTIONS.map((k) => ({ value: k, label: k })),
                          ]}
                        />
                      </Form.Item>
                    )}
                    {showSecurity && (
                      <Form.Item label={t('pages.clients.vmessSecurity')}>
                        <Select
                          value={form.security}
                          onChange={(v) => update('security', v)}
                          options={VMESS_SECURITY_OPTIONS.map((k) => ({ value: k, label: k }))}
                        />
                      </Form.Item>
                    )}
                    {showWireguard && (
                      <>
                        <Form.Item label={t('pages.clients.wireguardPrivateKey')}>
                          <Space.Compact style={{ display: 'flex' }}>
                            <Input
                              value={form.wgPrivateKey}
                              style={{ flex: 1 }}
                              onChange={(e) => {
                                const priv = e.target.value;
                                update('wgPrivateKey', priv);
                                update('wgPublicKey', priv ? Wireguard.generateKeypair(priv).publicKey : '');
                              }}
                            />
                            <Button aria-label={t('regenerate')} icon={<ReloadOutlined />} onClick={regenerateWireguardKeys} />
                          </Space.Compact>
                        </Form.Item>
                        <Form.Item label={t('pages.clients.wireguardPublicKey')}>
                          <Input value={form.wgPublicKey} disabled />
                        </Form.Item>
                        <Form.Item label={t('pages.clients.wireguardPreSharedKey')}>
                          <Space.Compact style={{ width: '100%' }}>
                            <Input
                              value={form.wgPreSharedKey}
                              onChange={(e) => update('wgPreSharedKey', e.target.value)}
                            />
                            <Button aria-label={t('regenerate')} icon={<ReloadOutlined />} onClick={generateWireguardPresharedKey} />
                          </Space.Compact>
                        </Form.Item>
                        <Form.Item
                          label={t('pages.clients.wireguardAllowedIPs')}
                          extra={t('pages.clients.wireguardAllowedIPsHint')}
                        >
                          <Input
                            value={form.wgAllowedIPs}
                            placeholder="10.0.0.2/32"
                            onChange={(e) => update('wgAllowedIPs', e.target.value)}
                          />
                        </Form.Item>
                      </>
                    )}
                  </>
                ),
              },
              {
                key: 'links',
                label: t('pages.clients.tabLinks'),
                children: (
                  <>
                    <Typography.Paragraph type="secondary" style={{ marginTop: 4 }}>
                      {t('pages.clients.externalLinksDesc') || t('pages.clients.linksHint')}
                    </Typography.Paragraph>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                      <Button type="primary" icon={<PlusOutlined />} onClick={() => addExternalLinkRow('link')}>
                        {t('pages.clients.addExternalLink')}
                      </Button>
                      <Button type="dashed" icon={<PlusOutlined />} onClick={() => addExternalLinkRow('link', 'vless://uuid@domain:443?type=tcp&security=reality#External-VLESS')}>
                        + VLESS
                      </Button>
                      <Button type="dashed" icon={<PlusOutlined />} onClick={() => addExternalLinkRow('link', 'trojan://password@domain:443?security=tls#External-Trojan')}>
                        + Trojan
                      </Button>
                      <Button type="dashed" icon={<PlusOutlined />} onClick={() => addExternalLinkRow('subscription', 'https://')}>
                        {t('pages.clients.addExternalSub')}
                      </Button>
                    </div>

                    <div style={{ marginTop: 12, marginBottom: 24 }}>
                      <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                        {t('pages.clients.externalLinks')} ({linkRows.length})
                      </Typography.Text>
                      {linkRows.length === 0 ? (
                        <Typography.Text type="secondary">{t('pages.clients.noExternalLinks')}</Typography.Text>
                      ) : linkRows.map((row) => (
                        <div key={row.key} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                          <Input
                            value={row.value}
                            aria-label="vless:// · vmess:// · trojan:// · ss:// · hysteria2:// · wireguard://"
                            onChange={(e) => updateExternalLinkRow(row.key, e.target.value)}
                            placeholder="vless:// · vmess:// · trojan:// · ss:// · hysteria2:// · wireguard://"
                          />
                          {row.value && (
                            <Tooltip title={t('copy')}>
                              <Button
                                aria-label={t('copy')}
                                icon={<CopyOutlined />}
                                onClick={() => ClipboardManager.copyText(row.value, t('copied'))}
                              />
                            </Tooltip>
                          )}
                          <Tooltip title={t('delete')}>
                            <Button aria-label={t('delete')} danger icon={<DeleteOutlined />} onClick={() => removeExternalLinkRow(row.key)} />
                          </Tooltip>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: 16 }}>
                      <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                        {t('pages.clients.externalSubscriptions') || 'External Subscriptions'} ({subscriptionRows.length})
                      </Typography.Text>
                      {subscriptionRows.length === 0 ? (
                        <Typography.Text type="secondary">{t('pages.clients.noExternalSubscriptions')}</Typography.Text>
                      ) : subscriptionRows.map((row) => (
                        <div key={row.key} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                          <Input
                            value={row.value}
                            aria-label="https://provider.example/sub/…"
                            onChange={(e) => updateExternalLinkRow(row.key, e.target.value)}
                            placeholder="https://provider.example/sub/…"
                          />
                          {row.value && (
                            <Tooltip title={t('copy')}>
                              <Button
                                aria-label={t('copy')}
                                icon={<CopyOutlined />}
                                onClick={() => ClipboardManager.copyText(row.value, t('copied'))}
                              />
                            </Tooltip>
                          )}
                          <Tooltip title={t('delete')}>
                            <Button aria-label={t('delete')} danger icon={<DeleteOutlined />} onClick={() => removeExternalLinkRow(row.key)} />
                          </Tooltip>
                        </div>
                      ))}
                    </div>
                  </>
                ),
              },
            ]}
          />
        </Form>
      </Modal>

      <Modal
        open={ipsModalOpen}
        title={`${t('pages.clients.ipLog')}${client?.email ? ` — ${client.email}` : ''}`}
        width={440}
        zIndex={CLIENT_IP_LOG_MODAL_Z_INDEX}
        onCancel={() => setIpsModalOpen(false)}
        footer={[
          <Button key="refresh" icon={<ReloadOutlined />} loading={ipsLoading} onClick={loadIps}>
            {t('refresh')}
          </Button>,
          <Button key="clear" danger loading={ipsClearing} disabled={clientIps.length === 0} onClick={clearIps}>
            {t('pages.clients.clearAll')}
          </Button>,
          <Button key="close" type="primary" onClick={() => setIpsModalOpen(false)}>
            {t('close')}
          </Button>,
        ]}
      >
        {clientIps.length > 0 ? (
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {clientIps.map((entry, idx) => (
              <Tag
                key={idx}
                color="blue"
                style={{
                  display: 'block',
                  width: 'fit-content',
                  maxWidth: '100%',
                  marginBottom: 6,
                  padding: '2px 8px',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                }}
              >
                {entry.ip}{entry.time ? ` (${entry.time})` : ''}
                {entry.node ? (
                  <span style={{ marginInlineStart: 6, opacity: 0.85, fontWeight: 600 }}>@ {entry.node}</span>
                ) : null}
              </Tag>
            ))}
          </div>
        ) : (
          <Tag>{t('tgbot.noIpRecord')}</Tag>
        )}
      </Modal>

      <ClientHwidListModal
        open={hwidsModalOpen}
        email={isEdit && client?.email ? client.email : ''}
        clientEmail={isEdit && client?.email ? client.email : ''}
        hwids={clientHwids}
        loading={hwidsLoading}
        clearing={hwidsClearing}
        deletingId={deletingHwidId}
        deletingHwidId={deletingHwidId}
        formatDate={(ts) => (ts > 0 ? IntlUtil.formatDate(ts, datepicker) : '-')}
        onRefresh={loadHwids}
        onClearAll={clearHwids}
        onDelete={deleteHwid}
        onDeleteSingle={deleteHwid}
        onClose={() => setHwidsModalOpen(false)}
      />
    </>
  );
}
