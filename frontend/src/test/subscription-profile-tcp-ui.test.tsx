import { fireEvent, render, waitFor } from '@testing-library/react';
import { Form, type FormInstance } from 'antd';
import { describe, expect, it } from 'vitest';

import ProfileSimpleTransportFields from '@/pages/inbounds/form/transport/subscription-profile-simple-transport-fields';

const absoluteBase: (string | number)[] = [
  'streamSettings',
  'externalProxy',
  0,
];

function Harness({ expose }: { expose: (form: FormInstance) => void }) {
  const [form] = Form.useForm();
  expose(form);

  return (
    <Form
      form={form}
      initialValues={{
        streamSettings: {
          externalProxy: [
            {
              tcpSettings: {
                acceptProxyProtocol: false,
                header: { type: 'none' },
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
            <ProfileSimpleTransportFields
              fieldName={field.name}
              absoluteBase={[...absoluteBase]}
              network="tcp"
              form={form}
            />
          );
        }}
      </Form.List>
    </Form>
  );
}

function httpObfuscationSwitch(container: HTMLElement): HTMLButtonElement {
  const field = Array.from(container.querySelectorAll('.ext-proxy-field'))
    .find((node) => (
      node.querySelector('.ext-proxy-flabel')?.textContent?.includes('HTTP')
    ));
  const control = field?.querySelector('[role="switch"]');
  expect(control).toBeInstanceOf(HTMLButtonElement);
  return control as HTMLButtonElement;
}

describe('subscription profile TCP transport UI', () => {
  it('toggles HTTP obfuscation and reveals the request and response editors', async () => {
    let form: FormInstance | undefined;
    const { container } = render(
      <Harness expose={(instance) => { form = instance; }} />,
    );

    const toggle = httpObfuscationSwitch(container);
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(
      container.querySelector('.ext-proxy-transport-block--connection'),
    ).not.toBeNull();
    expect(
      container.querySelector('.ext-proxy-transport-block__title'),
    ).toBeNull();
    expect(
      container.querySelectorAll('.ext-proxy-transport-toggle'),
    ).toHaveLength(2);

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(form?.getFieldValue([
        ...absoluteBase,
        'tcpSettings',
        'header',
        'type',
      ])).toBe('http');
      expect(
        httpObfuscationSwitch(container).getAttribute('aria-checked'),
      ).toBe('true');
      expect(container.querySelectorAll('input[placeholder="1.1"]'))
        .toHaveLength(2);
      expect(container.querySelectorAll('.ext-proxy-transport-block'))
        .toHaveLength(1);
      expect(
        container.querySelector('.ext-proxy-transport-camouflage'),
      ).not.toBeNull();
      expect(
        container.querySelector(
          '.ext-proxy-transport-request-response--stacked',
        ),
      ).not.toBeNull();
      expect(
        container.querySelector('[data-testid="tcp-http-obfuscation-panel"]'),
      ).not.toBeNull();
      expect(container.querySelectorAll('.ext-proxy-transport-subsection'))
        .toHaveLength(2);
      expect(
        container.querySelectorAll(
          '.ext-proxy-transport-subsection--camouflage',
        ),
      ).toHaveLength(2);
      expect(container.querySelectorAll('.ext-proxy-header-editor'))
        .toHaveLength(2);
    });

    expect(form?.getFieldValue([
      ...absoluteBase,
      'tcpSettings',
      'acceptProxyProtocol',
    ])).toBe(false);

    fireEvent.click(httpObfuscationSwitch(container));

    await waitFor(() => {
      expect(form?.getFieldValue([
        ...absoluteBase,
        'tcpSettings',
        'header',
        'type',
      ])).toBe('none');
      expect(
        httpObfuscationSwitch(container).getAttribute('aria-checked'),
      ).toBe('false');
      expect(container.querySelectorAll('input[placeholder="1.1"]'))
        .toHaveLength(0);
      expect(
        container.querySelector('.ext-proxy-transport-camouflage'),
      ).toBeNull();
    });
  });
});
