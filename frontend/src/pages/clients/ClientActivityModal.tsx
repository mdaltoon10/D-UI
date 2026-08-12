import React, { useEffect, useState } from 'react';
import { Modal, Table, Button, Space, Typography } from 'antd';
import { ReloadOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ClientRecord } from '@/hooks/useClients';

interface ClientActivityModalProps {
  open: boolean;
  client: ClientRecord | null;
  onClose: () => void;
}

interface ActivityRecord {
  id: string;
  destination: string;
  sourceIp: string;
  upload: string;
  download: string;
}

const MOCK_DATA: ActivityRecord[] = [
  { id: '1', destination: '149.154.166.120', sourceIp: '91.108.56.122', upload: '151.95 KB', download: '41.84 MB' },
  { id: '2', destination: 'www.googleapis.com', sourceIp: '91.108.56.122', upload: '48.05 KB', download: '102.50 KB' },
  { id: '3', destination: 'android.googleapis.com', sourceIp: '91.108.56.122', upload: '9.83 KB', download: '14.07 KB' },
  { id: '4', destination: '1.1.1.1', sourceIp: '91.108.56.122', upload: '2.50 KB', download: '5.93 KB' },
  { id: '5', destination: '149.154.167.92', sourceIp: '91.108.56.122', upload: '117.34 KB', download: '436.39 KB' },
  { id: '6', destination: 'z-m-gateway.facebook.com', sourceIp: '91.108.56.122', upload: '2.19 KB', download: '4.02 KB' },
  { id: '7', destination: '149.154.175.56', sourceIp: '91.108.56.122', upload: '1.07 KB', download: '3.05 KB' },
];

const ClientActivityModal: React.FC<ClientActivityModalProps> = ({ open, client, onClose }) => {
  const [data, setData] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && client) {
      setLoading(true);
      // Simulate API call
      setTimeout(() => {
        setData(MOCK_DATA);
        setLoading(false);
      }, 500);
    } else {
      setData([]);
    }
  }, [open, client]);

  const columns = [
    {
      title: 'Observed Destination',
      dataIndex: 'destination',
      key: 'destination',
    },
    {
      title: 'Source IP',
      dataIndex: 'sourceIp',
      key: 'sourceIp',
    },
    {
      title: 'Upload',
      dataIndex: 'upload',
      key: 'upload',
    },
    {
      title: 'Download',
      dataIndex: 'download',
      key: 'download',
    },
  ];

  return (
    <Modal
      title={
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Typography.Text strong>Client Activity — {client?.email || 'Unknown'}</Typography.Text>
          <Typography.Text type="success" style={{ fontSize: '12px' }}>Activity Monitoring: Enabled</Typography.Text>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button danger icon={<DeleteOutlined />} type="text">Reset Activity Data</Button>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => {
              setLoading(true);
              setTimeout(() => setLoading(false), 500);
            }}>Refresh</Button>
            <Button onClick={onClose}>Close</Button>
          </Space>
        </div>
      }
      width={800}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>Destinations: {data.length}</Typography.Text>
      </div>
      <Table
        dataSource={data}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={false}
        loading={loading}
        scroll={{ y: 400 }}
      />
    </Modal>
  );
};

export default ClientActivityModal;
