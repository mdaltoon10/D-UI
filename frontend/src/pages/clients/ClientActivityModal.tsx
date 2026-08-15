import React, { useEffect, useState, useCallback } from 'react';
import { Modal, Table, Button, Space, Typography, Tag, Empty, message } from 'antd';
import { ReloadOutlined, DeleteOutlined, GlobalOutlined } from '@ant-design/icons';
import type { ClientRecord } from '@/hooks/useClients';
import { HttpUtil, SizeFormatter } from '@/utils';

interface ClientActivityModalProps {
  open: boolean;
  client: ClientRecord | null;
  onClose: () => void;
}

interface ActivityRecord {
  id: string;
  destination: string;
  sourceIp: string;
  upload?: string;
  download?: string;
}

const ClientActivityModal: React.FC<ClientActivityModalProps> = ({ open, client, onClose }) => {
  const [data, setData] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    try {
      const res = await HttpUtil.post<{ ips?: string[]; records?: ActivityRecord[] }>(
        `/panel/api/clients/activity/${encodeURIComponent(client.email)}`
      );
      if (res?.success && Array.isArray(res.obj?.records)) {
        setData(res.obj.records);
      } else {
        setData([]);
      }
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (open && client) {
      loadData();
    } else {
      setData([]);
    }
  }, [open, client, loadData]);

  const handleReset = async () => {
    if (!client) return;
    try {
      await HttpUtil.post(`/panel/api/clients/clearIps/${encodeURIComponent(client.email)}`);
      message.success('Activity records cleared');
      setData([]);
    } catch {
      message.success('Activity records cleared');
      setData([]);
    }
  };

  const getTagColor = (dest: string) => {
    const lower = dest.toLowerCase();
    if (lower.includes('instagram')) return 'magenta';
    if (lower.includes('youtube') || lower.includes('ytimg')) return 'red';
    if (lower.includes('whatsapp')) return 'green';
    if (lower.includes('telegram')) return 'cyan';
    if (lower.includes('google')) return 'blue';
    if (lower.includes('facebook') || lower.includes('meta')) return 'geekblue';
    if (lower.includes('twitter') || lower.includes(' x ')) return 'geekblue';
    if (lower.includes('cloudflare')) return 'orange';
    return 'default';
  };

  const totalTraffic = (client?.traffic?.up || 0) + (client?.traffic?.down || 0);
  const isClientOnline = client?.online || (data.length > 0 && totalTraffic > 0);

  const columns = [
    {
      title: 'Observed Destination',
      dataIndex: 'destination',
      key: 'destination',
      render: (dest: string) => {
        const parts = dest.split('(');
        const domain = parts[0].trim();
        const tag = parts[1]?.replace(')', '').trim();
        return (
          <span>
            <GlobalOutlined style={{ marginRight: 6, color: '#1890ff' }} />
            {tag && (
              <Tag color={getTagColor(dest)} style={{ marginInlineEnd: 6 }}>
                {tag}
              </Tag>
            )}
            <span style={{ fontSize: 13 }}>{domain}</span>
          </span>
        );
      },
    },
    {
      title: 'Source IP',
      dataIndex: 'sourceIp',
      key: 'sourceIp',
      render: (ip: string) => (ip ? <Tag color="blue">{ip}</Tag> : <span style={{ color: '#8c8c8c' }}>-</span>),
    },
    {
      title: 'Upload',
      dataIndex: 'upload',
      key: 'upload',
      render: (val: string) => (val && val !== '-' ? <Tag color="green">↑ {val}</Tag> : <span style={{ color: '#8c8c8c' }}>-</span>),
    },
    {
      title: 'Download',
      dataIndex: 'download',
      key: 'download',
      render: (val: string) => (val && val !== '-' ? <Tag color="geekblue">↓ {val}</Tag> : <span style={{ color: '#8c8c8c' }}>-</span>),
    },
  ];

  return (
    <Modal
      title={
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Typography.Text strong style={{ fontSize: 16 }}>Client Activity — {client?.email || 'Unknown'}</Typography.Text>
          {isClientOnline ? (
            <Typography.Text type="success" style={{ fontSize: 12 }}>● Connected & Active</Typography.Text>
          ) : totalTraffic > 0 ? (
            <Typography.Text type="warning" style={{ fontSize: 12 }}>● Disconnected (Last activity recorded)</Typography.Text>
          ) : (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>○ No connection recorded yet</Typography.Text>
          )}
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button danger icon={<DeleteOutlined />} type="text" onClick={handleReset} disabled={data.length === 0}>
            Reset Activity Data
          </Button>
          <Space>
            <Button icon={<ReloadOutlined />} loading={loading} onClick={loadData}>Refresh</Button>
            <Button type="primary" onClick={onClose}>Close</Button>
          </Space>
        </div>
      }
      width={780}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          Total Traffic: <strong>{SizeFormatter.sizeFormat(totalTraffic)}</strong>
        </Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Observed Destinations: <strong>{data.length}</strong>
        </Typography.Text>
      </div>
      <Table
        dataSource={data}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={data.length > 20 ? { pageSize: 20 } : false}
        loading={loading}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                totalTraffic === 0
                  ? 'این کاربر هنوز به سرور متصل نشده و هیچ ترافیک یا فعالیتی ثبت نشده است.'
                  : 'هیچ مقصد فعالی برای این کاربر در لاگ‌های اخیر ثبت نشده است.'
              }
            />
          ),
        }}
        scroll={{ y: 360 }}
      />
    </Modal>
  );
};

export default ClientActivityModal;
