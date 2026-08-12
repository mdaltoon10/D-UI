import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

function source(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

describe('subscription profile transport presentation foundation', () => {
  it('keeps presentation primitives separate from form and runtime logic', () => {
    const uiSource = source(
      'src/pages/inbounds/form/transport/subscription-profile-transport-ui.tsx',
    );

    expect(uiSource).toContain('ProfileTransportBlock');
    expect(uiSource).toContain('ProfileTransportToggleRow');
    expect(uiSource).toContain('ProfileTransportSubsection');
    expect(uiSource).not.toContain('setFieldValue');
    expect(uiSource).not.toContain('Form.Item');
    expect(uiSource).not.toContain('runtime');
  });

  it('uses a transport-only CSS namespace and a compact header toolbar', () => {
    const css = source(
      'src/pages/inbounds/form/transport/external-proxy.css',
    );
    const simpleTransportSource = source(
      'src/pages/inbounds/form/transport/subscription-profile-simple-transport-fields.tsx',
    );
    const headerEditorSource = source('src/components/form/HeaderMapEditor.tsx');

    expect(css).toContain('.ext-proxy-transport-block');
    expect(css).toContain('.ext-proxy-transport-toggle');
    expect(css).toContain('.ext-proxy-header-editor__toolbar');
    expect(css).toContain('.ext-proxy-header-editor__add.ant-btn');
    expect(simpleTransportSource).toContain('data-transport="tcp"');
    expect(simpleTransportSource).toContain('variant="profile"');
    expect(headerEditorSource).toContain("variant?: 'default' | 'profile'");
  });

  it('uses one compact row language for TCP and shared transport options', () => {
    const css = source(
      'src/pages/inbounds/form/transport/external-proxy.css',
    );
    const editorSource = source(
      'src/pages/inbounds/form/transport/subscription-profile-editor.tsx',
    );
    const simpleTransportSource = source(
      'src/pages/inbounds/form/transport/subscription-profile-simple-transport-fields.tsx',
    );
    const clientSockoptSource = source(
      'src/pages/hosts/json-forms/HostSockoptForm.tsx',
    );

    expect(simpleTransportSource).toContain(
      'ext-proxy-transport-block--connection',
    );
    expect(simpleTransportSource).not.toContain('title="TCP / RAW"');
    expect(editorSource).toContain('ext-proxy-transport-options');
    expect(editorSource).toContain('variant="profile"');
    expect(clientSockoptSource).toContain(
      "variant?: 'default' | 'profile'",
    );
    expect(css).toContain('.ext-proxy-transport-options');
    expect(css).toContain('.ext-proxy-transport-option__content');
    expect(simpleTransportSource).toContain(
      'ext-proxy-transport-camouflage',
    );
    expect(simpleTransportSource).toContain(
      'ext-proxy-transport-subsection--camouflage',
    );
    expect(simpleTransportSource).toContain(
      'ext-proxy-transport-request-response--stacked',
    );
    expect(simpleTransportSource).not.toContain(
      "title={`HTTP ${t('camouflage')}`}",
    );
    expect(css).toContain('.ext-proxy-transport-grid--http-request');
    expect(css).toContain('.ext-proxy-transport-grid--http-response');
    expect(css).toContain(
      '.ext-proxy-transport-request-response--stacked',
    );
    expect(simpleTransportSource).toMatch(
      /columns=\{1\}[\s\S]*className="ext-proxy-transport-grid--http-request"/,
    );
    expect(simpleTransportSource).toMatch(
      /columns=\{1\}[\s\S]*className="ext-proxy-transport-grid--http-response"/,
    );
    expect(css).toContain('max-width: 220px;');
    expect(css).toContain('max-width: 320px;');
    expect(css).toContain('gap: 24px;');
    expect(css).toMatch(
      /ext-proxy-transport-grid--http-request[\s\S]*ext-proxy-transport-field \{[\s\S]*gap: 8px;/,
    );
    expect(css).not.toContain('minmax(220px, 1.7fr)');
  });
});
