import React, { useState } from 'react';
import { Alert, Button, Card, Collapse, Form, Input, InputNumber, Select, Space, Switch, Tag, Typography } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';

export interface SubscriptionProfile {
  id: string;
  enabled: boolean;
  name: string;
  address: string;
  port?: number;
  network: string;
  security: string;
  path?: string;
  host?: string;
  sni?: string;
}

interface SubscriptionProfilesFormProps {
  protocol: string;
}

export const SubscriptionProfilesForm: React.FC<SubscriptionProfilesFormProps> = ({ protocol }) => {
  const [enabled, setEnabled] = useState(false);
  const [profiles, setProfiles] = useState<SubscriptionProfile[]>([
    {
      id: '1',
      enabled: true,
      name: 'Profile 1',
      address: '',
      network: 'tcp',
      security: 'none',
      path: '',
      host: '',
    },
    {
      id: '2',
      enabled: true,
      name: 'Profile 2',
      address: '',
      network: 'ws',
      security: 'tls',
      path: '/ws',
      host: 'cdn.example.com',
      sni: 'cdn.example.com',
    },
  ]);

  const handleAddProfile = () => {
    const nextNum = profiles.length + 1;
    const newProf: SubscriptionProfile = {
      id: Date.now().toString(),
      enabled: true,
      name: `Profile ${nextNum}`,
      address: '',
      network: 'ws',
      security: 'tls',
      path: `/path-${nextNum}`,
    };
    setProfiles([...profiles, newProf]);
  };

  const handleRemoveProfile = (id: string) => {
    setProfiles(profiles.filter((p) => p.id !== id));
  };

  const handleUpdateProfile = (id: string, patch: Partial<SubscriptionProfile>) => {
    setProfiles(profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  return (
    <div style={{ marginTop: 16, marginBottom: 16, borderTop: '1px solid var(--ant-color-border-secondary)', paddingTop: 16 }}>
      <Form.Item label="Subscription Profiles">
        <Switch checked={enabled} onChange={setEnabled} />
      </Form.Item>

      {enabled && (
        <div style={{ marginTop: 12 }}>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message={`Protocol ${protocol.toUpperCase()}, client identity and account limits are inherited from the parent inbound and cannot be changed here.`}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            {profiles.map((prof, idx) => (
              <Card
                key={prof.id}
                size="small"
                style={{
                  background: 'var(--ant-color-fill-quaternary)',
                  borderColor: 'var(--ant-color-border-secondary)',
                  borderRadius: 8,
                }}
              >
                <Collapse
                  ghost
                  defaultActiveKey={idx === 1 ? ['1'] : []}
                  items={[
                    {
                      key: '1',
                      label: (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <Space onClick={(e) => e.stopPropagation()}>
                            <Switch
                              size="small"
                              checked={prof.enabled}
                              onChange={(v) => handleUpdateProfile(prof.id, { enabled: v })}
                            />
                            <Typography.Text strong>{prof.name || `Profile ${idx + 1}`}</Typography.Text>
                            <Tag color="blue">{prof.network.toUpperCase()}</Tag>
                            <Tag color={prof.security === 'tls' ? 'green' : prof.security === 'reality' ? 'purple' : 'default'}>
                              {prof.security.toUpperCase()}
                            </Tag>
                            <Tag color="cyan">{protocol.toUpperCase()}</Tag>
                          </Space>
                          <Button
                            danger
                            type="text"
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveProfile(prof.id);
                            }}
                          />
                        </div>
                      ),
                      children: (
                        <div style={{ paddingTop: 8 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                            <div>
                              <Typography.Text type="secondary" style={{ fontSize: 12 }}>Profile Name</Typography.Text>
                              <Input
                                value={prof.name}
                                onChange={(e) => handleUpdateProfile(prof.id, { name: e.target.value })}
                                placeholder="Profile Name"
                              />
                            </div>
                            <div>
                              <Typography.Text type="secondary" style={{ fontSize: 12 }}>Address</Typography.Text>
                              <Input
                                value={prof.address}
                                onChange={(e) => handleUpdateProfile(prof.id, { address: e.target.value })}
                                placeholder="Leave Blank to use the Inbound/Node address"
                              />
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                            <div>
                              <Typography.Text type="secondary" style={{ fontSize: 12 }}>Port</Typography.Text>
                              <InputNumber
                                style={{ width: '100%' }}
                                value={prof.port}
                                onChange={(v) => handleUpdateProfile(prof.id, { port: Number(v) || undefined })}
                                placeholder="Port"
                              />
                            </div>
                            <div>
                              <Typography.Text type="secondary" style={{ fontSize: 12 }}>Transport</Typography.Text>
                              <Select
                                style={{ width: '100%' }}
                                value={prof.network}
                                onChange={(v) => handleUpdateProfile(prof.id, { network: v })}
                                options={[
                                  { value: 'tcp', label: 'RAW' },
                                  { value: 'ws', label: 'WebSocket' },
                                  { value: 'grpc', label: 'gRPC' },
                                  { value: 'httpupgrade', label: 'HTTPUpgrade' },
                                  { value: 'xhttp', label: 'XHTTP' },
                                ]}
                              />
                            </div>
                            <div>
                              <Typography.Text type="secondary" style={{ fontSize: 12 }}>Security</Typography.Text>
                              <Select
                                style={{ width: '100%' }}
                                value={prof.security}
                                onChange={(v) => handleUpdateProfile(prof.id, { security: v })}
                                options={[
                                  { value: 'none', label: 'NONE' },
                                  { value: 'tls', label: 'TLS' },
                                  { value: 'reality', label: 'REALITY' },
                                ]}
                              />
                            </div>
                          </div>

                          <Collapse
                            size="small"
                            items={[
                              {
                                key: 'transport',
                                label: 'Transport Settings',
                                children: (
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div>
                                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>Path / ServiceName</Typography.Text>
                                      <Input
                                        value={prof.path}
                                        onChange={(e) => handleUpdateProfile(prof.id, { path: e.target.value })}
                                        placeholder="/path"
                                      />
                                    </div>
                                    <div>
                                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>Host</Typography.Text>
                                      <Input
                                        value={prof.host}
                                        onChange={(e) => handleUpdateProfile(prof.id, { host: e.target.value })}
                                        placeholder="Host Header"
                                      />
                                    </div>
                                  </div>
                                ),
                              },
                              {
                                key: 'security',
                                label: 'Security Settings',
                                children: (
                                  <div>
                                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>SNI / ServerName</Typography.Text>
                                    <Input
                                      value={prof.sni}
                                      onChange={(e) => handleUpdateProfile(prof.id, { sni: e.target.value })}
                                      placeholder="server.domain.com"
                                    />
                                  </div>
                                ),
                              },
                              {
                                key: 'advanced',
                                label: 'Advanced Client Settings',
                                children: (
                                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                    Custom headers, fingerprinting overrides, and extra subscription parameters.
                                  </Typography.Text>
                                ),
                              },
                            ]}
                          />
                        </div>
                      ),
                    },
                  ]}
                />
              </Card>
            ))}
          </div>

          <Button
            type="dashed"
            block
            icon={<PlusOutlined />}
            onClick={handleAddProfile}
          >
            Add Subscription Profile
          </Button>
        </div>
      )}
    </div>
  );
};

export default SubscriptionProfilesForm;
