import { fireEvent, render, waitFor } from '@testing-library/react';
import { Form, InputNumber, type FormInstance } from 'antd';
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';

import { FormField } from '@/components/form/rhf';
import {
  createProfileRuntimeRealityDefaults,
  createProfileRuntimeTlsDefaults,
} from '@/lib/xray/forms/security';
import ExternalProxyForm from '@/pages/inbounds/form/transport/external-proxy';

const initialValues = {
  protocol: 'vless',
  port: 443,
  streamSettings: {
    network: 'tcp',
    security: 'none',
    externalProxy: [
      {
        enabled: true,
        remark: 'Inherited profile',
        dest: '',
        port: 443,
        network: 'same',
        security: 'same',
        forceTls: 'same',
      },
    ],
  },
};

function Harness() {
  const methods = useForm({
    defaultValues: initialValues,
  });
  const [form] = Form.useForm();
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <FormProvider {...methods}>
        <Form form={form} initialValues={initialValues}>
          <div data-testid="inbound-port">
            <FormField name="port" label="Inbound port">
              <InputNumber min={1} max={65535} />
            </FormField>
          </div>
          <ExternalProxyForm />
          <button
            type="button"
            onClick={() => {
              methods.setValue(
                'streamSettings.network',
                'httpupgrade',
                { shouldDirty: true },
              );
              methods.setValue(
                'streamSettings.security',
                'tls',
                { shouldDirty: true },
              );
            }}
          >
            Change parent stream
          </button>
        </Form>
      </FormProvider>
    </QueryClientProvider>
  );
}

function InheritedSecurityHarness({
  security,
  expose,
}: {
  security: 'tls' | 'reality';
  expose: (form: FormInstance) => void;
}) {
  const runtimeSettings = security === 'tls'
    ? {
      tlsSettings: {
        ...createProfileRuntimeTlsDefaults(),
        serverName: 'legacy-server.example',
      },
    }
    : {
      realitySettings: {
        ...createProfileRuntimeRealityDefaults(),
        serverNames: ['legacy-server.example'],
      },
    };
  const parentSecuritySettings = security === 'tls'
    ? {
      tlsSettings: {
        serverName: 'parent.example',
        alpn: [],
        settings: { fingerprint: 'chrome' },
      },
    }
    : {
      realitySettings: {
        serverNames: ['parent-one.example', 'parent-two.example'],
        shortIds: [],
        settings: {
          serverName: 'parent-one.example',
          fingerprint: 'chrome',
        },
      },
    };
  const values = {
    protocol: 'vless',
    port: 443,
    streamSettings: {
      network: 'tcp',
      security,
      ...parentSecuritySettings,
      externalProxy: [
        {
          enabled: true,
          remark: `Inherited ${security}`,
          dest: '',
          port: 443,
          network: 'same',
          security: 'same',
          forceTls: 'same',
          runtime: {
            enabled: true,
            id: `inherited-${security}`,
            mode: 'direct',
            listen: '',
            port: 443,
            ...runtimeSettings,
          },
        },
      ],
    },
  };
  const methods = useForm({ defaultValues: values });
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
        <Form form={form} initialValues={values}>
          <ExternalProxyForm />
        </Form>
      </FormProvider>
    </QueryClientProvider>
  );
}

function profileSummary(container: HTMLElement): string[] {
  return Array.from(
    container.querySelectorAll(
      '.ext-proxy-card__summary',
    ),
  ).map((element) => element.textContent ?? '');
}

describe('subscription profile inherited summary', () => {
  it('reacts to the actual parent RHF stream values', async () => {
    const { container, getByRole } = render(<Harness />);

    await waitFor(() => {
      expect(profileSummary(container)).toEqual([
        'TCP',
        'NONE',
      ]);
    });

    fireEvent.click(
      getByRole('button', {
        name: 'Change parent stream',
      }),
    );

    await waitFor(() => {
      expect(profileSummary(container)).toEqual([
        'HTTPUPGRADE',
        'TLS',
      ]);
    });
  });

  it('synchronizes the inbound and default profile ports on change without blur', async () => {
    const { container, getByTestId } = render(<Harness />);
    const inboundInput = getByTestId('inbound-port').querySelector('input');
    const profileInput = container.querySelector(
      '.ext-proxy-grid--common .ant-input-number-input',
    );

    expect(inboundInput).toBeInstanceOf(HTMLInputElement);
    expect(profileInput).toBeInstanceOf(HTMLInputElement);

    fireEvent.change(inboundInput as HTMLInputElement, {
      target: { value: '2443' },
    });

    await waitFor(() => {
      expect((profileInput as HTMLInputElement).value).toBe('2443');
    });

    fireEvent.change(profileInput as HTMLInputElement, {
      target: { value: '3443' },
    });

    await waitFor(() => {
      expect((inboundInput as HTMLInputElement).value).toBe('3443');
    });
  });

  it('synchronizes inherited TLS SNI into a runtime server override', async () => {
    let form: FormInstance | undefined;
    render(
      <InheritedSecurityHarness
        security="tls"
        expose={(instance) => { form = instance; }}
      />,
    );

    await waitFor(() => {
      expect(form?.getFieldValue([
        'streamSettings',
        'externalProxy',
        0,
        'runtime',
        'tlsSettings',
        'serverName',
      ])).toBe('parent.example');
    });
  });

  it('synchronizes inherited REALITY SNI into a runtime server override', async () => {
    let form: FormInstance | undefined;
    render(
      <InheritedSecurityHarness
        security="reality"
        expose={(instance) => { form = instance; }}
      />,
    );

    await waitFor(() => {
      expect(form?.getFieldValue([
        'streamSettings',
        'externalProxy',
        0,
        'runtime',
        'realitySettings',
        'serverNames',
      ])).toEqual(['parent-one.example', 'parent-two.example']);
    });
  });

});
