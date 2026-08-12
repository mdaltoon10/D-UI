import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CopyOutlined } from '@ant-design/icons';
import { Alert, Button, Collapse, Modal, Spin, Tag, message } from 'antd';
import { ClipboardManager, HttpUtil } from '@/utils';
import { isPostQuantumLink } from '@/lib/xray/inbound-link';
import { LinkTags, linkMetaText, parseLinkParts } from '@/lib/xray/link-label';
import { QrPanel } from '@/pages/inbounds/qr';
import type { ClientRecord, InboundOption } from '@/hooks/useClients';
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
  msg?: string;
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
  const [messageApi, messageContextHolder] = message.useMessage();
  const [links, setLinks] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [linksError, setLinksError] = useState('');

  const subLink = useMemo(() => {
    if (!client?.subId || !subSettings?.enable || !subSettings?.subURI) return '';
    return subSettings.subURI + client.subId;
  }, [client?.subId, subSettings?.enable, subSettings?.subURI]);

  const subJsonLink = useMemo(() => {
    if (!client?.subId || !subSettings?.enable) return '';
    if (!subSettings?.subJsonEnable || !subSettings?.subJsonURI) return '';
    return subSettings.subJsonURI + client.subId;
  }, [client?.subId, subSettings?.enable, subSettings?.subJsonEnable, subSettings?.subJsonURI]);

  const wgInbound = useMemo(() => findWireguardInbound(client, inboundsById), [client, inboundsById]);
  const wgConfigText = useMemo(() => {
    if (!client || !wgInbound || !isWireguardClient(client)) return '';
    return buildWireguardClientConfig(client, wgInbound, window.location.hostname, subSettings?.publicHost ?? '');
  }, [client, wgInbound, subSettings?.publicHost]);

  const hasAnything = !!subLink || !!subJsonLink || !!wgConfigText || links.length > 0;
  const hasPostQuantumLinks = useMemo(() => links.some(isPostQuantumLink), [links]);

  useEffect(() => {
    if (!open || !client?.subId) {
      setLinks([]);
      setLoading(false);
      setLinksError('');
      return;
    }

    let cancelled = false;
    setLinks([]);
    setLoading(true);
    setLinksError('');

    (async () => {
      try {
        const msg = await HttpUtil.get(
          `/panel/api/clients/subLinks/${encodeURIComponent(client.subId!)}`,
          undefined,
          { silent: true },
        ) as ApiMsg<string[]>;
        if (cancelled) return;

        if (!msg?.success) {
          setLinksError(msg?.msg?.trim() || t('pages.clients.configLoadError', {
            defaultValue: 'Failed to load client configurations.',
          }));
          return;
        }
        if (!Array.isArray(msg.obj)) {
          setLinksError(t('pages.clients.configInvalidResponse', {
            defaultValue: 'The server returned an invalid configuration response.',
          }));
          return;
        }
        setLinks(msg.obj);
      } catch (error) {
        if (cancelled) return;
        setLinksError(error instanceof Error && error.message
          ? error.message
          : t('pages.clients.configLoadError', {
              defaultValue: 'Failed to load client configurations.',
            }));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, client?.subId, t]);

  const [activeKey, setActiveKey] = useState<string[]>([]);

  const copyConfig = useCallback(async (value: string) => {
    const copied = await ClipboardManager.copyText(value);
    if (copied) messageApi.success(t('copied'));
  }, [messageApi, t]);

  const items = useMemo(() => {
    const out: { key: string; label: React.ReactNode; children: React.ReactNode }[] = [];
    if (subLink) {
      out.push({
        key: 'sub',
        label: t('subscription.title'),
        children: <QrPanel value={subLink} remark={`${client?.email || ''} — ${t('subscription.title')}`} />,
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
      const canQr = !isPostQuantumLink(link);
      out.push({
        key: `l${idx}`,
        label,
        children: (
          <>
            <QrPanel
              value={link}
              remark={parts?.remark || `${client?.email || ''} #${idx + 1}`}
              showQr={canQr}
            />
            {!canQr && (
              <>
                <Button
                  type="primary"
                  block
                  icon={<CopyOutlined />}
                  onClick={() => copyConfig(link)}
                  style={{ marginTop: 12 }}
                >
                  {t('pages.clients.copyConfig', { defaultValue: 'Copy config' })}
                </Button>
                <Alert
                type="info"
                showIcon
                title={t('pages.clients.postQuantumQrUnavailable', {
                  defaultValue: 'Direct QR is unavailable for post-quantum configs',
                })}
                description={subLink
                  ? t('pages.clients.postQuantumQrUseSubscription', {
                      defaultValue: 'These configs contain a large post-quantum parameter. Copy the config directly, or scan the subscription QR above.',
                    })
                  : t('pages.clients.postQuantumQrCopy', {
                      defaultValue: 'These configs contain a large post-quantum parameter. Copy the config directly instead.',
                    })}
                  style={{ marginTop: 12 }}
                />
              </>
            )}
          </>
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
  }, [subLink, subJsonLink, wgConfigText, links, client?.email, copyConfig, t]);

  useEffect(() => {
    if (!open) {
      setActiveKey([]);
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
      {messageContextHolder}
      <Spin spinning={loading}>
        {linksError && (
          <Alert
            type="error"
            showIcon
            title={t('pages.clients.configLoadErrorTitle', {
              defaultValue: 'Configuration loading failed',
            })}
            description={linksError}
            style={{ marginBottom: 12 }}
          />
        )}
        {!client?.subId && !loading && (
          <Alert
            type="warning"
            showIcon
            title={t('pages.clients.noSubId', { defaultValue: 'This client has no subscription ID.' })}
          />
        )}
        {client?.subId && !hasAnything && !loading && !linksError && (
          <Alert
            type="info"
            showIcon
            title={t('pages.clients.noGeneratedConfigs', {
              defaultValue: 'No client configurations were generated.',
            })}
            description={t('pages.clients.noGeneratedConfigsHint', {
              defaultValue: 'Check that the client is attached to at least one enabled and supported inbound.',
            })}
          />
        )}
        {hasPostQuantumLinks && subLink && (
          <Alert
            type="info"
            showIcon
            title={t('pages.clients.postQuantumQrSubscriptionAvailable', {
              defaultValue: 'Use the subscription QR for post-quantum configs',
            })}
            description={t('pages.clients.postQuantumQrUseSubscription', {
              defaultValue: 'These configs contain a large post-quantum parameter. Copy the config directly, or scan the subscription QR above.',
            })}
            style={{ marginBottom: 12 }}
          />
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
