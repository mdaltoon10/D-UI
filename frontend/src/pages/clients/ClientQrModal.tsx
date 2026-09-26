import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button, Collapse, Modal, Segmented, Spin, Tag } from 'antd';
import { LockOutlined, QrcodeOutlined, SettingOutlined } from '@ant-design/icons';
import { Base64, HttpUtil } from '@/utils';
import { isPostQuantumLink } from '@/lib/xray/inbound-link';
import { LinkTags, linkMetaText, parseLinkParts } from '@/lib/xray/link-label';
import { QrPanel } from '@/pages/inbounds/qr';
import type { ClientRecord, InboundOption } from '@/hooks/useClients';
import { useAllSettings } from '@/api/queries/useAllSettings';
import { buildWireguardClientConfig, findWireguardInbound, isWireguardClient } from './wireguardConfig';

interface SubSettings {
  enable: boolean;
  subURI: string;
  subJsonURI: string;
  subJsonEnable: boolean;
  publicHost?: string;
}

interface ClientQrModalProps {
  open: boolean;
  client: ClientRecord | null;
  inboundsById: Record<number, InboundOption>;
  subSettings?: SubSettings;
  onOpenChange: (open: boolean) => void;
}

interface ApiMsg<T = unknown> {
  success?: boolean;
  obj?: T;
}

const DEFAULT_SUB: SubSettings = { enable: false, subURI: '', subJsonURI: '', subJsonEnable: false, publicHost: '' };

export default function ClientQrModal({
  open,
  client,
  inboundsById,
  subSettings = DEFAULT_SUB,
  onOpenChange,
}: ClientQrModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { allSetting } = useAllSettings();
  const [links, setLinks] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [subType, setSubType] = useState<'standard' | 'happ'>('standard');

  const subLink = useMemo(() => {
    if (!client?.subId || !subSettings?.enable || !subSettings?.subURI) return '';
    return subSettings.subURI + client.subId;
  }, [client?.subId, subSettings?.enable, subSettings?.subURI]);

  const subJsonLink = useMemo(() => {
    if (!client?.subId || !subSettings?.enable) return '';
    if (!subSettings?.subJsonEnable || !subSettings?.subJsonURI) return '';
    return subSettings.subJsonURI + client.subId;
  }, [client?.subId, subSettings?.enable, subSettings?.subJsonEnable, subSettings?.subJsonURI]);

  const happEncryptedLink = useMemo(() => {
    if (!subLink) return '';
    const b64 = Base64.encode(subLink, true);
    return `happ://crypt5/${b64}`;
  }, [subLink]);

  const wgInbound = useMemo(() => findWireguardInbound(client, inboundsById), [client, inboundsById]);
  const wgConfigText = useMemo(() => {
    if (!client || !wgInbound || !isWireguardClient(client)) return '';
    return buildWireguardClientConfig(client, wgInbound, window.location.hostname, subSettings?.publicHost ?? '');
  }, [client, wgInbound, subSettings?.publicHost]);

  const hasAnything = !!subLink || !!subJsonLink || !!wgConfigText || links.length > 0;

  useEffect(() => {
    if (!open || !client?.subId) {
      setLinks([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const msg = await HttpUtil.get(
          `/panel/api/clients/subLinks/${encodeURIComponent(client.subId!)}`,
        ) as ApiMsg<string[]>;
        if (!cancelled) {
          setLinks(msg?.success && Array.isArray(msg.obj) ? msg.obj : []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, client?.subId]);

  const [activeKey, setActiveKey] = useState<string[]>([]);

  const items = useMemo(() => {
    const out: { key: string; label: React.ReactNode; children: React.ReactNode }[] = [];
    if (subLink) {
      out.push({
        key: 'sub',
        label: t('subscription.title'),
        children: (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Segmented
                value={subType}
                onChange={(val) => setSubType(val as 'standard' | 'happ')}
                options={[
                  { label: 'Standard', value: 'standard', icon: <QrcodeOutlined /> },
                  { label: 'Happ Encrypted Link', value: 'happ', icon: <LockOutlined /> },
                ]}
              />
            </div>

            {subType === 'standard' && (
              <QrPanel value={subLink} remark={`${client?.email || ''} — ${t('subscription.title')}`} />
            )}

            {subType === 'happ' && (
              allSetting?.happEncryptEnable ? (
                <QrPanel value={happEncryptedLink} remark={`${client?.email || ''} — Happ Encrypted`} />
              ) : (
                <div style={{ textAlign: 'center', padding: '36px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <LockOutlined style={{ fontSize: 44, opacity: 0.35 }} />
                  <div style={{ fontSize: 16, fontWeight: 600 }}>Happ encrypted link generation is not enabled</div>
                  <div style={{ fontSize: 13, opacity: 0.6, maxWidth: 320 }}>
                    Enable local generation of encrypted Happ subscription links. (Only for Happ)
                  </div>
                  <Button
                    type="primary"
                    icon={<SettingOutlined />}
                    onClick={() => {
                      onOpenChange(false);
                      navigate('/settings#happ');
                    }}
                    style={{ marginTop: 6 }}
                  >
                    Go to Settings
                  </Button>
                </div>
              )
            )}
          </div>
        ),
      });
    }
    if (subJsonLink) {
      out.push({
        key: 'subJson',
        label: `${t('subscription.title')} (JSON)`,
        children: <QrPanel value={subJsonLink} remark={`${client?.email || ''} — JSON`} />,
      });
    }
    links.forEach((link, idx) => {
      const parts = parseLinkParts(link);
      const meta = parts ? linkMetaText(parts) : '';
      const label: React.ReactNode = parts ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <LinkTags parts={parts} />
          {meta && <span style={{ opacity: 0.6, fontSize: 12 }}>({meta})</span>}
        </span>
      ) : `${t('pages.clients.link')} ${idx + 1}`;
      out.push({
        key: `l${idx}`,
        label,
        children: (
          <QrPanel
            value={link}
            remark={parts?.remark || `${client?.email || ''} #${idx + 1}`}
            showQr={!isPostQuantumLink(link)}
          />
        ),
      });
    });
    if (wgConfigText) {
      out.push({
        key: 'wg-config',
        label: <Tag color="cyan" style={{ margin: 0 }}>{t('pages.clients.wireguardConfig')}</Tag>,
        children: (
          <QrPanel
            value={wgConfigText}
            remark={client?.email || 'peer'}
            downloadName={`${client?.email || 'peer'}.conf`}
          />
        ),
      });
    }
    return out;
  }, [subLink, subType, allSetting?.happEncryptEnable, happEncryptedLink, subJsonLink, links, wgConfigText, client?.email, t, onOpenChange, navigate]);

  useEffect(() => {
    if (!open) {
      setActiveKey([]);
      setSubType('standard');
      return;
    }
    setActiveKey(items.length > 0 ? [items[0].key] : []);
  }, [open, items]);

  return (
    <Modal
      open={open}
      title={client ? `${t('qrCode')} — ${client.email}` : t('qrCode')}
      footer={null}
      width={520}
      centered
      onCancel={() => onOpenChange(false)}
    >
      <Spin spinning={loading}>
        {!client?.subId && !loading && (
          <div style={{ padding: 24, textAlign: 'center', opacity: 0.6 }}>{t('pages.clients.noSubId')}</div>
        )}
        {client?.subId && !hasAnything && !loading && (
          <div style={{ padding: 24, textAlign: 'center', opacity: 0.6 }}>{t('pages.clients.noLinks')}</div>
        )}
        {hasAnything && (
          <Collapse
            activeKey={activeKey}
            onChange={(keys) => setActiveKey(typeof keys === 'string' ? [keys] : (keys as string[]))}
            items={items}
          />
        )}
      </Spin>
    </Modal>
  );
}
