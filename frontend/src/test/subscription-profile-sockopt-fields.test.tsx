import { fireEvent, render, waitFor } from '@testing-library/react';
import { Form } from 'antd';
import { describe, expect, it } from 'vitest';

import { createSockoptDefaults } from '@/lib/xray/forms/transport/sockopt-foundation';
import ProfileRuntimeSockoptFields from '@/pages/inbounds/form/transport/subscription-profile-sockopt-fields';

const initialValues = {
  streamSettings: {
    externalProxy: [{
      wsSettings: {
        acceptProxyProtocol: false,
        path: '/',
        host: '',
        headers: {},
        heartbeatPeriod: 0,
      },
      runtime: {
        sockopt: createSockoptDefaults(),
      },
    }],
  },
};

function Harness() {
  const [form] = Form.useForm();
  const profile = Form.useWatch(
    ['streamSettings', 'externalProxy', 0],
    { form, preserve: true },
  );

  return (
    <Form form={form} initialValues={initialValues}>
      <Form.List name={['streamSettings', 'externalProxy']}>
        {(fields) => fields.map((field) => (
          <ProfileRuntimeSockoptFields
            key={field.key}
            fieldName={field.name}
            absoluteBase={['streamSettings', 'externalProxy', field.name]}
            network="ws"
            sockopt={profile?.runtime?.sockopt}
            form={form}
          />
        ))}
      </Form.List>
      <pre data-testid="profile-state">{JSON.stringify(profile ?? {})}</pre>
    </Form>
  );
}

function state(container: HTMLElement) {
  const raw = container.querySelector('[data-testid="profile-state"]')?.textContent;
  return JSON.parse(raw || '{}') as {
    wsSettings?: { acceptProxyProtocol?: boolean };
    runtime?: {
      sockopt?: {
        acceptProxyProtocol?: boolean;
        trustedXForwardedFor?: string[];
      };
    };
  };
}

describe('profile runtime Sockopt fields', () => {
  it('synchronizes Cloudflare and PROXY presets with transport-level proxy protocol', async () => {
    const { container, findByText } = render(<Harness />);

    fireEvent.click(await findByText('Cloudflare CDN'));
    await waitFor(() => {
      expect(state(container).runtime?.sockopt).toMatchObject({
        acceptProxyProtocol: false,
        trustedXForwardedFor: ['CF-Connecting-IP'],
      });
      expect(state(container).wsSettings?.acceptProxyProtocol).toBe(false);
    });

    fireEvent.click(await findByText('L4 relay / Spectrum (PROXY)'));
    await waitFor(() => {
      expect(state(container).runtime?.sockopt).toMatchObject({
        acceptProxyProtocol: true,
        trustedXForwardedFor: [],
      });
      expect(state(container).wsSettings?.acceptProxyProtocol).toBe(true);
    });
  });
});
