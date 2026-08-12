import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

function source(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

describe('subscription profile all-transports presentation', () => {
  it('uses the shared transport shell for every simple transport', () => {
    const simple = source(
      'src/pages/inbounds/form/transport/subscription-profile-simple-transport-fields.tsx',
    );
    const editor = source(
      'src/pages/inbounds/form/transport/subscription-profile-editor.tsx',
    );

    for (const transport of ['tcp', 'ws', 'grpc', 'httpupgrade', 'kcp']) {
      expect(simple).toContain(`data-transport="${transport}"`);
    }

    expect(simple).toContain('variant="profile"');
    expect(simple).toContain('ProfileTransportToggleRow');
    expect(simple).toContain('ProfileTransportBlock');
    expect(editor).toMatch(/network === 'kcp'[\s\S]*ProfileSimpleTransportFields/);
    expect(editor).not.toContain('<Field label="MTU">');
  });

  it('keeps WebSocket and HTTP Upgrade request headers inside Connection', () => {
    const simple = source(
      'src/pages/inbounds/form/transport/subscription-profile-simple-transport-fields.tsx',
    );
    const css = source(
      'src/pages/inbounds/form/transport/external-proxy.css',
    );
    const ws = simple.slice(
      simple.indexOf('function WsProfileTransportFields'),
      simple.indexOf('function GrpcProfileTransportFields'),
    );
    const httpUpgrade = simple.slice(
      simple.indexOf('function HttpUpgradeProfileTransportFields'),
      simple.indexOf('function KcpProfileTransportFields'),
    );

    for (const transport of [ws, httpUpgrade]) {
      expect(transport.match(/<ProfileTransportBlock/g)).toHaveLength(1);
      expect(transport).toContain('ext-proxy-transport-inline-headers');
      expect(transport).toContain("pages.inbounds.form.requestHeaders");
      expect(transport).not.toContain('ext-proxy-transport-block--headers');
    }

    expect(ws).toContain("[fieldName, 'wsSettings', 'headers']");
    expect(httpUpgrade).toContain(
      "[fieldName, 'httpupgradeSettings', 'headers']",
    );
    expect(css).toContain('.ext-proxy-transport-inline-headers');
    expect(css).toMatch(
      /\.ext-proxy-transport-inline-headers\s*\{[\s\S]*?padding:\s*14px 16px 16px;[\s\S]*?border:\s*1px solid var\(--ant-color-border-secondary\);[\s\S]*?border-radius:\s*10px;[\s\S]*?background:\s*var\(--ant-color-fill-quaternary\);/,
    );
  });

  it('groups XHTTP into named blocks without changing its canonical paths', () => {
    const xhttp = source(
      'src/pages/inbounds/form/transport/subscription-profile-xhttp-fields.tsx',
    );

    expect(xhttp).toContain('data-transport="xhttp"');
    expect(xhttp).toContain("defaultValue: 'Connection'");
    expect(xhttp).toContain("defaultValue: 'Upload and server limits'");
    expect(xhttp).toContain("defaultValue: 'Padding obfuscation'");
    expect(xhttp).toContain("defaultValue: 'Session routing'");
    expect(xhttp).toContain("defaultValue: 'Sequence and uplink routing'");
    expect(xhttp).toContain('title="XMUX"');
    expect(xhttp).toContain("defaultValue: 'Advanced flags'");
    expect(xhttp).toContain('variant="profile"');

    for (const path of [
      'scMaxEachPostBytes',
      'scMaxBufferedPosts',
      'scMinPostsIntervalMs',
      'scStreamUpServerSecs',
      'sessionIDPlacement',
      'sessionIDTable',
      'sessionIDLength',
      'seqPlacement',
      'uplinkDataPlacement',
      'xPaddingObfsMode',
      'noSSEHeader',
      'noGRPCHeader',
      'uplinkChunkSize',
    ]) {
      expect(xhttp).toContain(`'${path}'`);
    }

    expect(xhttp).toContain('prepareXhttpSettingsForMode');
    expect(xhttp).toContain('sanitizeXhttpSettings');
    expect(xhttp).toContain('createFreshXhttpXmux');
  });

  it('polishes all shared expanded transport options under isolated classes', () => {
    const css = source(
      'src/pages/inbounds/form/transport/external-proxy.css',
    );
    const editor = source(
      'src/pages/inbounds/form/transport/subscription-profile-editor.tsx',
    );
    const clientSockopt = source(
      'src/pages/xray/outbounds/transport/sockopt.tsx',
    );
    const listenerSockopt = source(
      'src/pages/inbounds/form/transport/subscription-profile-sockopt-fields.tsx',
    );

    expect(editor).toContain('ext-proxy-profile-finalmask-form');
    expect(clientSockopt).toContain('ext-proxy-profile-client-sockopt');
    expect(listenerSockopt).toContain('ext-proxy-profile-listener-sockopt');
    expect(listenerSockopt).toContain('ext-proxy-transport-subsection--plain');

    expect(css).toContain('.ext-proxy-profile-finalmask-form');
    expect(css).toContain('.ext-proxy-profile-client-sockopt');
    expect(css).toContain('.ext-proxy-profile-listener-sockopt');
    expect(css).toContain('.ext-proxy-xhttp-shell');
    expect(css).toContain('.ext-proxy-transport-block--toggle-section');
  });
});
