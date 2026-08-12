import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { Form, type FormInstance } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import {
  createProfileRuntimeRealityDefaults,
  createProfileRuntimeTlsDefaults,
} from '@/lib/xray/forms/security';
import ExternalProxyForm from '@/pages/inbounds/form/transport/external-proxy';
import {
  ProfileClientSecurityFields,
  ProfileRuntimeServerSecurityFields,
} from '@/pages/inbounds/form/transport/subscription-profile-security-fields';
import type {
  SubscriptionProfileSecurityActions,
} from '@/pages/inbounds/form/transport/use-subscription-profile-security-actions';

const absoluteBase: (string | number)[] = ['streamSettings', 'externalProxy', 0];
const certificatePath: (string | number)[] = [
  ...absoluteBase,
  'runtime',
  'tlsSettings',
  'certificates',
];

function securityActions(): SubscriptionProfileSecurityActions {
  return {
    securityBusy: false,
    scanning: false,
    scanResult: null,
    pinFromRemoteCertificate: vi.fn(),
    pinFromRuntimeCertificate: vi.fn(),
    setRuntimeCertFromPanel: vi.fn(),
    clearRuntimeCertFiles: vi.fn(),
    generateEch: vi.fn(),
    clearEch: vi.fn(),
    generateRealityKeypair: vi.fn(),
    clearRealityKeypair: vi.fn(),
    generateMldsa65: vi.fn(),
    clearMldsa65: vi.fn(),
    randomizeShortIds: vi.fn(),
    randomizeSpiderX: vi.fn(),
    applyRealityScanResult: vi.fn(),
    scanRealityTarget: vi.fn(),
    scanRealityCandidates: vi.fn(),
  } as unknown as SubscriptionProfileSecurityActions;
}

interface SniSyncHarnessProps {
  security: 'tls' | 'reality';
  profile: Record<string, unknown>;
  expose: (form: FormInstance) => void;
}

function SniSyncHarness({ security, profile, expose }: SniSyncHarnessProps) {
  const [form] = Form.useForm();
  expose(form);
  const runtime = profile.runtime as Record<string, unknown> | undefined;
  const settings = security === 'tls'
    ? runtime?.tlsSettings
    : runtime?.realitySettings;

  return (
    <Form
      form={form}
      initialValues={{
        streamSettings: {
          externalProxy: [profile],
        },
      }}
    >
      <Form.List name={['streamSettings', 'externalProxy']}>
        {(fields) => {
          const field = fields[0];
          if (!field) return null;
          return (
            <>
              <ProfileClientSecurityFields
                fieldName={field.name}
                absoluteBase={[...absoluteBase]}
                security={security}
                form={form}
                actions={securityActions()}
              />
              <ProfileRuntimeServerSecurityFields
                fieldName={field.name}
                absoluteBase={[...absoluteBase]}
                security={security}
                inheritedSecurity="none"
                required
                settings={settings as Record<string, unknown>}
                form={form}
                actions={securityActions()}
              />
            </>
          );
        }}
      </Form.List>
    </Form>
  );
}

function Harness({ expose }: { expose: (form: FormInstance) => void }) {
  const [form] = Form.useForm();
  const tlsSettings = createProfileRuntimeTlsDefaults();
  expose(form);

  return (
    <Form
      form={form}
      initialValues={{
        streamSettings: {
          externalProxy: [
            {
              runtime: {
                tlsSettings,
              },
            },
          ],
        },
      }}
    >
      <Form.List name={['streamSettings', 'externalProxy']}>
        {(fields) => {
          const field = fields[0];
          if (!field) return null;
          return (
            <ProfileRuntimeServerSecurityFields
              fieldName={field.name}
              absoluteBase={[...absoluteBase]}
              security="tls"
              inheritedSecurity="none"
              required
              settings={tlsSettings}
              form={form}
              actions={securityActions()}
            />
          );
        }}
      </Form.List>
    </Form>
  );
}


const integratedInitialValues = {
  protocol: 'vless',
  port: 443,
  streamSettings: {
    network: 'tcp',
    security: 'none',
    externalProxy: [
      {
        enabled: true,
        remark: 'Default profile',
        dest: '',
        port: 443,
        network: 'same',
        security: 'same',
        forceTls: 'same',
      },
      {
        enabled: true,
        remark: 'TLS runtime profile',
        dest: 'tls.example.test',
        port: 8443,
        network: 'same',
        security: 'tls',
        forceTls: 'tls',
        tlsSettings: {
          serverName: 'tls.example.test',
          alpn: [],
          settings: {
            fingerprint: 'chrome',
            echConfigList: '',
            pinnedPeerCertSha256: [],
            verifyPeerCertByName: '',
            allowInsecure: false,
          },
        },
        runtime: {
          enabled: true,
          id: 'tls-runtime-profile',
          mode: 'direct',
          listen: '',
          port: 8443,
          tlsSettings: createProfileRuntimeTlsDefaults(),
        },
      },
    ],
  },
};

function IntegratedHarness({ expose }: { expose: (form: FormInstance) => void }) {
  const methods = useForm({ defaultValues: integratedInitialValues });
  const [form] = Form.useForm();
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  expose(form);

  return (
    <QueryClientProvider client={queryClient}>
      <FormProvider {...methods}>
        <Form form={form} initialValues={integratedInitialValues}>
          <ExternalProxyForm />
        </Form>
      </FormProvider>
    </QueryClientProvider>
  );
}

describe('subscription profile TLS certificate editor', () => {
  it('updates the current certificate without creating duplicate rows', async () => {
    let form: FormInstance | undefined;
    const { container } = render(
      <Harness expose={(instance) => { form = instance; }} />,
    );

    await waitFor(() => {
      expect(container.querySelectorAll('.ext-proxy-certificate')).toHaveLength(1);
    });

    const inputs = container.querySelectorAll(
      '.ext-proxy-certificate .ant-input',
    );
    expect(inputs.length).toBeGreaterThanOrEqual(2);

    fireEvent.change(inputs[0], {
      target: { value: '/root/gogoli/cert.crt' },
    });
    fireEvent.change(inputs[1], {
      target: { value: '/root/gogoli/private.key' },
    });

    await waitFor(() => {
      expect(container.querySelectorAll('.ext-proxy-certificate')).toHaveLength(1);
      const certificates = form?.getFieldValue(certificatePath);
      expect(certificates).toHaveLength(1);
      expect(certificates[0]).toMatchObject({
        certificateFile: '/root/gogoli/cert.crt',
        keyFile: '/root/gogoli/private.key',
      });
    });
  });

  it('does not append certificates while typing through the complete profile editor', async () => {
    let form: FormInstance | undefined;
    const { container } = render(
      <IntegratedHarness expose={(instance) => { form = instance; }} />,
    );

    let tlsCard: HTMLElement | undefined;
    await waitFor(() => {
      const cards = container.querySelectorAll('.ext-proxy-card');
      expect(cards).toHaveLength(2);
      tlsCard = cards[1] as HTMLElement;
      expect(tlsCard!.querySelectorAll('.ext-proxy-certificate')).toHaveLength(1);
    });
    expect(tlsCard).toBeDefined();

    const inputs = tlsCard!.querySelectorAll(
      '.ext-proxy-certificate .ant-input',
    );
    expect(inputs.length).toBeGreaterThanOrEqual(2);
    fireEvent.change(inputs[0], {
      target: { value: '/root/gogoli/cert.crt' },
    });
    fireEvent.change(inputs[1], {
      target: { value: '/root/gogoli/private.key' },
    });

    await waitFor(() => {
      expect(tlsCard!.querySelectorAll('.ext-proxy-certificate')).toHaveLength(1);
      const certificates = form?.getFieldValue([
        'streamSettings',
        'externalProxy',
        1,
        'runtime',
        'tlsSettings',
        'certificates',
      ]);
      expect(certificates).toHaveLength(1);
      expect(certificates[0]).toMatchObject({
        certificateFile: '/root/gogoli/cert.crt',
        keyFile: '/root/gogoli/private.key',
      });
    });
  });

  it('uses the same responsive row grammar as the inbound security form', async () => {
    const { container } = render(
      <Harness expose={() => undefined} />,
    );

    await waitFor(() => {
      expect(container.querySelector('.ext-proxy-security-form')).not.toBeNull();
      expect(container.querySelector('.ext-proxy-certificate__head')).not.toBeNull();
      expect(
        container.querySelectorAll('.ext-proxy-security-row').length,
      ).toBeGreaterThan(8);
    });
  });

  it('shows one TLS SNI control and synchronizes it to runtime settings', async () => {
    let form: FormInstance | undefined;
    const runtimeTls = {
      ...createProfileRuntimeTlsDefaults(),
      serverName: 'legacy-server.example',
    };
    const { container } = render(
      <SniSyncHarness
        security="tls"
        profile={{
          dest: 'edge.example',
          overrideSniFromAddress: false,
          keepSniBlank: false,
          tlsSettings: { serverName: 'client.example' },
          runtime: { tlsSettings: runtimeTls },
        }}
        expose={(instance) => { form = instance; }}
      />,
    );

    await waitFor(() => {
      expect(form?.getFieldValue([
        ...absoluteBase,
        'runtime',
        'tlsSettings',
        'serverName',
      ])).toBe('client.example');
    });

    const sniLabels = Array.from(
      container.querySelectorAll('.ext-proxy-security-label'),
    ).filter((element) => element.textContent?.trim() === 'SNI');
    expect(sniLabels).toHaveLength(1);

    act(() => {
      form?.setFieldValue(
        [...absoluteBase, 'tlsSettings', 'serverName'],
        'next.example',
      );
    });

    await waitFor(() => {
      expect(form?.getFieldValue([
        ...absoluteBase,
        'runtime',
        'tlsSettings',
        'serverName',
      ])).toBe('next.example');
    });

    act(() => {
      form?.setFieldValue(
        [...absoluteBase, 'overrideSniFromAddress'],
        true,
      );
    });

    await waitFor(() => {
      expect(form?.getFieldValue([
        ...absoluteBase,
        'runtime',
        'tlsSettings',
        'serverName',
      ])).toBe('edge.example');
    });

    act(() => {
      form?.setFieldValue(
        [...absoluteBase, 'overrideSniFromAddress'],
        false,
      );
      form?.setFieldValue([...absoluteBase, 'keepSniBlank'], true);
    });

    await waitFor(() => {
      expect(form?.getFieldValue([
        ...absoluteBase,
        'runtime',
        'tlsSettings',
        'serverName',
      ])).toBe('');
    });
  });

  it('hydrates a legacy TLS runtime SNI into the client field once', async () => {
    let form: FormInstance | undefined;
    render(
      <SniSyncHarness
        security="tls"
        profile={{
          dest: '',
          overrideSniFromAddress: false,
          keepSniBlank: false,
          tlsSettings: { serverName: '' },
          runtime: {
            tlsSettings: {
              ...createProfileRuntimeTlsDefaults(),
              serverName: 'legacy.example',
            },
          },
        }}
        expose={(instance) => { form = instance; }}
      />,
    );

    await waitFor(() => {
      expect(form?.getFieldValue([
        ...absoluteBase,
        'tlsSettings',
        'serverName',
      ])).toBe('legacy.example');
    });
  });

  it('shows one REALITY SNI control and synchronizes its list and preference', async () => {
    let form: FormInstance | undefined;
    const runtimeReality = {
      ...createProfileRuntimeRealityDefaults(),
      serverNames: ['legacy.example'],
    };
    const { container } = render(
      <SniSyncHarness
        security="reality"
        profile={{
          realitySettings: {
            serverNames: ['one.example'],
            shortIds: [],
            settings: {
              serverName: 'missing.example',
              fingerprint: 'chrome',
            },
          },
          runtime: { realitySettings: runtimeReality },
        }}
        expose={(instance) => { form = instance; }}
      />,
    );

    await waitFor(() => {
      expect(form?.getFieldValue([
        ...absoluteBase,
        'runtime',
        'realitySettings',
        'serverNames',
      ])).toEqual(['one.example']);
      expect(form?.getFieldValue([
        ...absoluteBase,
        'realitySettings',
        'settings',
        'serverName',
      ])).toBe('one.example');
    });

    const sniLabels = Array.from(
      container.querySelectorAll('.ext-proxy-security-label'),
    ).filter((element) => element.textContent?.trim() === 'SNI');
    expect(sniLabels).toHaveLength(1);

    act(() => {
      form?.setFieldValue(
        [...absoluteBase, 'realitySettings', 'serverNames'],
        ['two.example', 'three.example'],
      );
    });

    await waitFor(() => {
      expect(form?.getFieldValue([
        ...absoluteBase,
        'runtime',
        'realitySettings',
        'serverNames',
      ])).toEqual(['two.example', 'three.example']);
      expect(form?.getFieldValue([
        ...absoluteBase,
        'realitySettings',
        'settings',
        'serverName',
      ])).toBe('two.example');
    });
  });

  it('hydrates legacy REALITY server names into the client fields once', async () => {
    let form: FormInstance | undefined;
    render(
      <SniSyncHarness
        security="reality"
        profile={{
          realitySettings: {
            serverNames: [],
            shortIds: [],
            settings: { serverName: '', fingerprint: 'chrome' },
          },
          runtime: {
            realitySettings: {
              ...createProfileRuntimeRealityDefaults(),
              serverNames: ['legacy-one.example', 'legacy-two.example'],
            },
          },
        }}
        expose={(instance) => { form = instance; }}
      />,
    );

    await waitFor(() => {
      expect(form?.getFieldValue([
        ...absoluteBase,
        'realitySettings',
        'serverNames',
      ])).toEqual(['legacy-one.example', 'legacy-two.example']);
      expect(form?.getFieldValue([
        ...absoluteBase,
        'realitySettings',
        'settings',
        'serverName',
      ])).toBe('legacy-one.example');
    });
  });
});
