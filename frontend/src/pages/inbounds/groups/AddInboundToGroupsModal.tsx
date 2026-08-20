import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Modal, Select, Space, Typography, message } from 'antd';
import { ForkOutlined } from '@ant-design/icons';
import { HttpUtil } from '@/utils';
import { SelectAllClearButtons } from '@/components/form';
import type { DBInboundRecord } from '../list/types';
import type { InboundGroupSummary } from '@/schemas/inboundGroup';

interface AddInboundToGroupsModalProps {
  open: boolean;
  inbound: DBInboundRecord | null;
  onClose: () => void;
  onAdded?: () => void;
}

export default function AddInboundToGroupsModal({
  open,
  inbound,
  onClose,
  onAdded,
}: AddInboundToGroupsModalProps) {
  const { t } = useTranslation();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [groups, setGroups] = useState<InboundGroupSummary[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [targetGroupIds, setTargetGroupIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setTargetGroupIds([]);
      return;
    }
    setTargetGroupIds([]);
    let cancelled = false;
    (async () => {
      setLoadingGroups(true);
      try {
        const res = await HttpUtil.get('/panel/api/inbound-groups/list', undefined, { silent: true });
        if (cancelled) return;
        if (res?.success && Array.isArray(res.obj)) {
          setGroups(res.obj as InboundGroupSummary[]);
        } else {
          setGroups([]);
        }
      } catch {
        if (!cancelled) setGroups([]);
      } finally {
        if (!cancelled) setLoadingGroups(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const groupOptions = useMemo(() => {
    return groups.map((g) => {
      const alreadyHasThisInbound = inbound && g.inboundIds?.includes(inbound.id);
      return {
        value: g.id,
        label: `${g.name}${g.remark ? ` (${g.remark})` : ''}${alreadyHasThisInbound ? ' [Already Added]' : ''}`,
      };
    });
  }, [groups, inbound]);

  const modalTitle = useMemo(() => {
    if (!inbound) return t('pages.inbounds.addToInboundGroup');
    return t('pages.inbounds.addToInboundGroupTitle', {
      remark: inbound.remark || `#${inbound.id}`,
    });
  }, [inbound, t]);

  const handleSubmit = async () => {
    if (!inbound || targetGroupIds.length === 0) return;
    setSubmitting(true);
    try {
      const res = await HttpUtil.post(
        '/panel/api/inbound-groups/addInbounds',
        {
          inboundIds: [inbound.id],
          groupIds: targetGroupIds,
        },
        { headers: { 'Content-Type': 'application/json' } }
      );
      if (res?.success) {
        const affected = (res.obj as { affected?: number })?.affected ?? targetGroupIds.length;
        messageApi.success(t('pages.inbounds.addToInboundGroupSuccess', { count: affected }));
        onAdded?.();
        setTimeout(() => {
          onClose();
        }, 300);
      } else {
        messageApi.error(res?.msg || t('somethingWentWrong'));
      }
    } catch {
      messageApi.error(t('somethingWentWrong'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {messageContextHolder}
      <Modal
        open={open}
        title={
          <Space align="center" size="small">
            <ForkOutlined className="text-primary" />
            <span>{modalTitle}</span>
          </Space>
        }
        onCancel={onClose}
        destroyOnClose
        width={560}
        footer={
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button onClick={onClose} disabled={submitting}>
              {t('cancel')}
            </Button>
            <Button
              type="primary"
              loading={submitting}
              disabled={targetGroupIds.length === 0 || groups.length === 0}
              onClick={handleSubmit}
            >
              {t('pages.inbounds.addToInboundGroupButton')}
            </Button>
          </div>
        }
      >
        <Typography.Paragraph type="secondary" className="mt-2 mb-4 text-sm leading-relaxed">
          {t('pages.inbounds.addToInboundGroupDesc')}
        </Typography.Paragraph>

        {loadingGroups ? (
          <div className="py-6 text-center text-neutral-400">{t('loading')}</div>
        ) : groupOptions.length === 0 ? (
          <Alert
            type="info"
            showIcon
            message={t('pages.inbounds.addToInboundGroupNoTargets')}
          />
        ) : (
          <div className="space-y-2">
            <SelectAllClearButtons
              options={groupOptions}
              value={targetGroupIds}
              onChange={setTargetGroupIds}
            />
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              value={targetGroupIds}
              onChange={setTargetGroupIds}
              options={groupOptions}
              placeholder={t('pages.inbounds.addToInboundGroupTargets')}
              optionFilterProp="label"
              allowClear
              autoFocus
            />
          </div>
        )}
      </Modal>
    </>
  );
}
