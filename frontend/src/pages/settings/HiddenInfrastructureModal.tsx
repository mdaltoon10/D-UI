import React, { useState } from 'react';
import { Modal, Tabs, Input, Button, Tag, Space, Typography, Table, Card, message } from 'antd';
import {
  CodeOutlined,
  EyeInvisibleOutlined,
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons';

interface HiddenInfrastructureModalProps {
  open: boolean;
  onClose: () => void;
}

interface HiddenItem {
  id: string;
  type: 'inbound_remark' | 'outbound_tag' | 'balancer_tag' | 'client_email';
  value: string;
  createdAt: string;
}

export const HiddenInfrastructureModal: React.FC<HiddenInfrastructureModalProps> = ({
  open,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'terminal' | 'gui'>('terminal');
  const [terminalOption, setTerminalOption] = useState<string>('');
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    'Run daltoon-ui to manage hidden inbounds, outbounds, balancers, and client identifiers from a simple terminal menu.',
    '',
    '1. Manage inbound remarks',
    '2. Manage outbound tags',
    '3. Manage balancer tags',
    '4. Manage client emails',
    '5. Show current hidden configuration',
    '0. Back to main menu',
    '',
  ]);

  const [items, setItems] = useState<HiddenItem[]>([
    { id: '1', type: 'inbound_remark', value: 'tunnel-internal-node1', createdAt: '2026-08-01' },
    { id: '2', type: 'outbound_tag', value: 'internal-bridge-out', createdAt: '2026-08-02' },
    { id: '3', type: 'client_email', value: 'admin-test@internal.local', createdAt: '2026-08-05' },
  ]);

  const [newValue, setNewValue] = useState('');
  const [selectedType, setSelectedType] = useState<HiddenItem['type']>('inbound_remark');

  const handleTerminalInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const val = terminalOption.trim();
      const newLogs = [...terminalLogs, `Choose an option [0-5]: ${val}`];

      if (val === '1') {
        newLogs.push('--> Managing Inbound Remarks: [Hidden: tunnel-internal-node1]');
      } else if (val === '2') {
        newLogs.push('--> Managing Outbound Tags: [Hidden: internal-bridge-out]');
      } else if (val === '3') {
        newLogs.push('--> Managing Balancer Tags: [No hidden balancers]');
      } else if (val === '4') {
        newLogs.push('--> Managing Client Emails: [Hidden: admin-test@internal.local]');
      } else if (val === '5') {
        newLogs.push('=== Current Hidden Infrastructure Config ===');
        items.forEach((item) => newLogs.push(` - [${item.type}] ${item.value}`));
      } else if (val === '0') {
        newLogs.push('Exiting daltoon-ui terminal interface...');
      } else {
        newLogs.push('Invalid option. Please enter a number between 0 and 5.');
      }

      newLogs.push('');
      newLogs.push('Choose an option [0-5]:');
      setTerminalLogs(newLogs);
      setTerminalOption('');
    }
  };

  const handleAddItem = () => {
    if (!newValue.trim()) return;
    const newItem: HiddenItem = {
      id: Date.now().toString(),
      type: selectedType,
      value: newValue.trim(),
      createdAt: new Date().toISOString().split('T')[0],
    };
    setItems([...items, newItem]);
    setNewValue('');
    message.success('Resource hidden successfully');
  };

  const handleDeleteItem = (id: string) => {
    setItems(items.filter((i) => i.id !== id));
    message.info('Resource unhidden');
  };

  const columns = [
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => <Tag color="cyan">{type.replace('_', ' ').toUpperCase()}</Tag>,
    },
    {
      title: 'Identifier / Remark / Tag',
      dataIndex: 'value',
      key: 'value',
      render: (val: string) => (
        <Typography.Text code>
          <EyeInvisibleOutlined /> {val}
        </Typography.Text>
      ),
    },
    {
      title: 'Date Added',
      dataIndex: 'createdAt',
      key: 'createdAt',
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: unknown, record: HiddenItem) => (
        <Button
          danger
          icon={<DeleteOutlined />}
          size="small"
          onClick={() => handleDeleteItem(record.id)}
        />
      ),
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <EyeInvisibleOutlined style={{ color: '#10b981' }} />
          <span>Hidden Infrastructure Management ($ daltoon-ui)</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={850}
    >
      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        Hidden Infrastructure allows internal resources (inbound remarks, outbound tags, balancers,
        client emails) to be hidden from normal views and subscription links without altering actual
        runtime behavior.
      </Typography.Paragraph>

      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as 'terminal' | 'gui')}
        items={[
          {
            key: 'terminal',
            label: (
              <span>
                <CodeOutlined /> Terminal Mode ($ daltoon-ui)
              </span>
            ),
            children: (
              <Card
                style={{
                  background: '#0d1117',
                  borderColor: '#30363d',
                  color: '#58a6ff',
                  fontFamily: 'monospace',
                  minHeight: '320px',
                }}
              >
                <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: 12 }}>
                  {terminalLogs.map((log, idx) => (
                    <div
                      key={idx}
                      style={{
                        color: log.startsWith('-->')
                          ? '#7ee787'
                          : log.startsWith('===')
                            ? '#ffa657'
                            : '#c9d1d9',
                      }}
                    >
                      {log}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ color: '#7ee787', marginRight: 8 }}>$ daltoon-ui &gt;</span>
                  <Input
                    variant="borderless"
                    value={terminalOption}
                    onChange={(e) => setTerminalOption(e.target.value)}
                    onKeyDown={handleTerminalInput}
                    placeholder="Enter option number (0-5) and press Enter..."
                    style={{ color: '#58a6ff', fontFamily: 'monospace' }}
                  />
                </div>
              </Card>
            ),
          },
          {
            key: 'gui',
            label: (
              <span>
                <CodeOutlined /> GUI Config
              </span>
            ),
            children: (
              <div>
                <Space style={{ marginBottom: 16 }} wrap>
                  <Button
                    type={selectedType === 'inbound_remark' ? 'primary' : 'default'}
                    onClick={() => setSelectedType('inbound_remark')}
                  >
                    Inbound Remarks
                  </Button>
                  <Button
                    type={selectedType === 'outbound_tag' ? 'primary' : 'default'}
                    onClick={() => setSelectedType('outbound_tag')}
                  >
                    Outbound Tags
                  </Button>
                  <Button
                    type={selectedType === 'balancer_tag' ? 'primary' : 'default'}
                    onClick={() => setSelectedType('balancer_tag')}
                  >
                    Balancer Tags
                  </Button>
                  <Button
                    type={selectedType === 'client_email' ? 'primary' : 'default'}
                    onClick={() => setSelectedType('client_email')}
                  >
                    Client Emails
                  </Button>
                </Space>

                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <Input
                    placeholder={`Enter ${selectedType.replace('_', ' ')} to hide...`}
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    onPressEnter={handleAddItem}
                  />
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleAddItem}>
                    Hide Item
                  </Button>
                </div>

                <Table
                  dataSource={items}
                  columns={columns}
                  rowKey="id"
                  size="small"
                  pagination={false}
                />
              </div>
            ),
          },
        ]}
      />
    </Modal>
  );
};

export default HiddenInfrastructureModal;
