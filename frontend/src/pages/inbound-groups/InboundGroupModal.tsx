import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
} from 'antd';
import {
  CloudServerOutlined,
  ForkOutlined,
} from '@ant-design/icons';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { InboundGroupSummary } from '@/schemas/inboundGroup';
import type { InboundOption } from '@/schemas/client';
import type { NodeRecord } from '@/schemas/node';

export interface InboundGroupFormValues {
  name: string;
  remark: string;
  inboundIds: number[];
  nodeIds: number[];
  enable: boolean;
}

interface InboundGroupModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  group: InboundGroupSummary | null;
  inboundOptions: InboundOption[];
  nodes: NodeRecord[];
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (values: InboundGroupFormValues) => Promise<void>;
}

export default function InboundGroupModal({
  open,
  mode,
  group,
  inboundOptions,
  nodes,
  submitting = false,
  onClose,
  onSubmit,
}: InboundGroupModalProps) {
  const { t } = useTranslation();
  const { isMobile } = useMediaQuery();
  const [form] = Form.useForm<InboundGroupFormValues>();

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && group) {
      form.setFieldsValue({
        name: group.name,
        remark: group.remark || '',
        inboundIds: group.inboundIds || [],
        nodeIds: group.nodeIds || [],
        enable: group.enable !== false,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        name: '',
        remark: '',
        inboundIds: [],
        nodeIds: [],
        enable: true,
      });
    }
  }, [open, mode, group, form]);

  const handleSelectAllInbounds = () => {
    form.setFieldValue(
      'inboundIds',
      inboundOptions.map((ib) => ib.id),
    );
  };

  const handleClearAllInbounds = () => {
    form.setFieldValue('inboundIds', []);
  };

  const handleSelectAllNodes = () => {
    form.setFieldValue(
      'nodeIds',
      nodes.map((n) => n.id),
    );
  };

  const handleClearAllNodes = () => {
    form.setFieldValue('nodeIds', []);
  };

  const handleFinish = async (values: InboundGroupFormValues) => {
    await onSubmit(values);
  };

  return (
    <Modal
      title={
        <Space orientation="horizontal" align="center" size="small">
          <ForkOutlined className="text-primary text-base" />
          <span>
            {mode === 'create'
              ? t('pages.inboundGroups.addGroup')
              : t('pages.inboundGroups.editGroup')}
          </span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      destroyOnClose
      width={isMobile ? '95vw' : 640}
      styles={{
        body: {
          maxHeight: '75vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingTop: 8,
        },
      }}
      footer={
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button onClick={onClose} disabled={submitting}>
            {t('cancel')}
          </Button>
          <Button
            type="primary"
            loading={submitting}
            onClick={() => form.submit()}
          >
            {mode === 'create' ? t('create') : t('save')}
          </Button>
        </div>
      }
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        className="mt-2"
      >
        <Form.Item
          name="name"
          label={t('pages.inboundGroups.name')}
          rules={[
            {
              required: true,
              message: t('pages.inboundGroups.name') + ' ' + t('cantBeEmpty'),
            },
          ]}
        >
          <Input
            placeholder={t('pages.inboundGroups.name')}
            autoFocus
            maxLength={64}
          />
        </Form.Item>

        <Form.Item name="remark" label={t('pages.inboundGroups.remark')}>
          <Input.TextArea
            rows={2}
            placeholder={t('pages.inboundGroups.remarkPlaceholder')}
            maxLength={256}
          />
        </Form.Item>

        <Form.Item
          name="inboundIds"
          label={
            <div className="flex items-center justify-between w-full">
              <Space orientation="horizontal" size="small">
                <ForkOutlined />
                <span>{t('pages.inboundGroups.selectInbounds')}</span>
              </Space>
              <Space size="small" className="text-xs font-normal">
                <Button
                  type="link"
                  size="small"
                  onClick={handleSelectAllInbounds}
                  className="p-0 text-xs h-auto"
                >
                  {t('pages.inboundGroups.selectAll')}
                </Button>
                <span className="text-neutral-400">|</span>
                <Button
                  type="link"
                  size="small"
                  onClick={handleClearAllInbounds}
                  className="p-0 text-xs h-auto text-neutral-400"
                >
                  {t('pages.inboundGroups.clearAll')}
                </Button>
              </Space>
            </div>
          }
          tooltip={t('pages.inboundGroups.selectInboundsPlaceholder')}
        >
          <Select
            mode="multiple"
            allowClear
            placeholder={t('pages.inboundGroups.selectInboundsPlaceholder')}
            optionFilterProp="label"
            options={inboundOptions.map((ib) => {
              const proto = (ib.protocol || '').toUpperCase();
              const tag = ib.tag || `Inbound #${ib.id}`;
              const label = `${ib.remark ? `${ib.remark} - ` : ''}${tag} [${proto}:${ib.port || 0}]`;
              return {
                value: ib.id,
                label: label,
              };
            })}
          />
        </Form.Item>

        <Form.Item
          name="nodeIds"
          label={
            <div className="flex items-center justify-between w-full">
              <Space orientation="horizontal" size="small">
                <CloudServerOutlined />
                <span>{t('pages.inboundGroups.selectNodes')}</span>
              </Space>
              <Space size="small" className="text-xs font-normal">
                <Button
                  type="link"
                  size="small"
                  onClick={handleSelectAllNodes}
                  className="p-0 text-xs h-auto"
                >
                  {t('pages.inboundGroups.selectAll')}
                </Button>
                <span className="text-neutral-400">|</span>
                <Button
                  type="link"
                  size="small"
                  onClick={handleClearAllNodes}
                  className="p-0 text-xs h-auto text-neutral-400"
                >
                  {t('pages.inboundGroups.clearAll')}
                </Button>
              </Space>
            </div>
          }
          tooltip={t('pages.inboundGroups.selectNodesPlaceholder')}
        >
          <Select
            mode="multiple"
            allowClear
            placeholder={t('pages.inboundGroups.selectNodesPlaceholder')}
            optionFilterProp="label"
            options={nodes.map((n) => {
              const isOnline = n.status === 'online';
              const name = n.name || `Node #${n.id}`;
              const label = `${name} (${n.address}:${n.port})${isOnline ? ' [Online]' : ' [Offline]'}`;
              return {
                value: n.id,
                label: label,
              };
            })}
          />
        </Form.Item>

        <Form.Item
          name="enable"
          label={t('pages.inboundGroups.status')}
          valuePropName="checked"
        >
          <Space align="center" size="small">
            <Switch aria-label={t('enable')} />
            <span className="text-sm font-normal text-neutral-400">
              {t('enable')}
            </span>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}
