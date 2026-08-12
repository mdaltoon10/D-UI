import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

function source(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

describe('subscription profile inherited summary wiring', () => {
  it('reads the parent stream from React Hook Form and passes it to each profile editor', () => {
    const listSource = source(
      'src/pages/inbounds/form/transport/external-proxy.tsx',
    );
    const editorSource = source(
      'src/pages/inbounds/form/transport/subscription-profile-editor.tsx',
    );

    expect(listSource).toMatch(
      /useWatch\(\{\s*control,\s*name:\s*['"]streamSettings\.network['"],?\s*\}\)/s,
    );
    expect(listSource).toMatch(
      /useWatch\(\{\s*control,\s*name:\s*['"]streamSettings\.security['"],?\s*\}\)/s,
    );
    expect(listSource).toContain('parentNetwork={parentNetwork}');
    expect(listSource).toContain('parentSecurity={parentSecurity}');

    expect(editorSource).toContain('parentNetwork: string;');
    expect(editorSource).toContain('parentSecurity: string;');
    expect(editorSource).not.toContain(
      "Form.useWatch(['streamSettings', 'network'], form)",
    );
    expect(editorSource).not.toContain(
      "Form.useWatch(['streamSettings', 'security'], form)",
    );
  });
});

describe('subscription profile security safety wiring', () => {
  it('does not generate random bytes as a certificate pin', () => {
    const editorSource = source(
      'src/pages/inbounds/form/transport/subscription-profile-editor.tsx',
    );
    const securityFieldsSource = source(
      'src/pages/inbounds/form/transport/subscription-profile-security-fields.tsx',
    );
    const securityActionsSource = source(
      'src/pages/inbounds/form/transport/use-subscription-profile-security-actions.ts',
    );

    expect(editorSource).not.toContain('generateRandomPin');
    expect(editorSource).not.toContain('crypto.getRandomValues(bytes)');
    expect(securityActionsSource).toContain('/panel/api/server/getRemoteCertHash');
    expect(securityActionsSource).toContain('/panel/api/server/getCertHash');
    expect(securityFieldsSource).toContain('preferredRealitySni');
    expect(securityFieldsSource).toContain('preferredRealityShortId');
  });
});

describe('subscription profile Phase 2A transport wiring', () => {
  it('routes simple transports through the shared profile transport component', () => {
    const editorSource = source(
      'src/pages/inbounds/form/transport/subscription-profile-editor.tsx',
    );
    const simpleTransportSource = source(
      'src/pages/inbounds/form/transport/subscription-profile-simple-transport-fields.tsx',
    );
    const rawInboundSource = source(
      'src/pages/inbounds/form/transport/raw.tsx',
    );

    expect(editorSource).toContain('ProfileSimpleTransportFields');
    expect(editorSource).toContain('createProfileTransportDefaults');
    expect(editorSource).toContain('profileTransportSettingsKey');

    expect(simpleTransportSource).toMatch(
      /name=\{\[\s*fieldName,\s*settingsKey,\s*['"]acceptProxyProtocol['"]\s*\]\}/s,
    );
    expect(simpleTransportSource).toContain("settingsKey=\"tcpSettings\"");
    expect(simpleTransportSource).toContain("settingsKey=\"wsSettings\"");
    expect(simpleTransportSource).toContain("settingsKey=\"httpupgradeSettings\"");
    expect(simpleTransportSource).toContain('responseVersion');
    expect(simpleTransportSource).toContain('responseStatus');
    expect(simpleTransportSource).toContain('responseReason');
    expect(simpleTransportSource).toContain('responseHeaders');
    expect(simpleTransportSource).toMatch(
      /<HeaderMapEditor[\s\S]*?mode=['"]v2['"][\s\S]*?variant=['"]profile['"]/,
    );
    expect(simpleTransportSource).toMatch(
      /<HeaderMapEditor(?=[^>]*\bmode=['"]v1['"])(?=[^>]*\bvariant=['"]profile['"])[^>]*\/>/s,
    );

    expect(rawInboundSource).toContain('createTcpHeaderForCamouflage');
  });
});

describe('subscription profile Phase 2B XHTTP wiring', () => {
  it('routes XHTTP through the shared foundation and canonical field names', () => {
    const editorSource = source(
      'src/pages/inbounds/form/transport/subscription-profile-editor.tsx',
    );
    const profileXhttpSource = source(
      'src/pages/inbounds/form/transport/subscription-profile-xhttp-fields.tsx',
    );
    const inboundXhttpSource = source(
      'src/pages/inbounds/form/transport/xhttp.tsx',
    );

    expect(editorSource).toContain('ProfileXhttpTransportFields');
    expect(editorSource).not.toContain("'xhttpSettings', 'sessionPlacement'");
    expect(editorSource).not.toContain("'xhttpSettings', 'sessionKey'");

    for (const required of [
      'scMaxEachPostBytes',
      'scMaxBufferedPosts',
      'scStreamUpServerSecs',
      'serverMaxHeaderBytes',
      'xPaddingPlacement',
      'xPaddingMethod',
      'sessionIDPlacement',
      'sessionIDTable',
      'sessionIDLength',
      'uplinkDataPlacement',
      'noSSEHeader',
      'createFreshXhttpXmux',
      'xhttpModeVisibility',
    ]) {
      expect(profileXhttpSource).toContain(required);
    }

    expect(profileXhttpSource).toContain('XHTTP_SESSION_ID_TABLES');
    expect(profileXhttpSource).toMatch(
      /<HeaderMapEditor(?=[^>]*\bmode=['"]v1['"])(?=[^>]*\bvariant=['"]profile['"])[^>]*\/>/s,
    );
    expect(inboundXhttpSource).toContain('xhttp-foundation');
    expect(inboundXhttpSource).toContain('prepareXhttpSettingsForMode');
    expect(inboundXhttpSource).toContain('sanitizeXhttpSettings');
  });
});

describe('subscription profile Phase 2D Sockopt wiring', () => {
  it('reuses one Sockopt foundation for inbound and runtime-profile editors', () => {
    const editorSource = source(
      'src/pages/inbounds/form/transport/subscription-profile-editor.tsx',
    );
    const profileSockoptSource = source(
      'src/pages/inbounds/form/transport/subscription-profile-sockopt-fields.tsx',
    );
    const inboundSockoptSource = source(
      'src/pages/inbounds/form/transport/sockopt.tsx',
    );
    const simpleTransportSource = source(
      'src/pages/inbounds/form/transport/subscription-profile-simple-transport-fields.tsx',
    );
    const hostSockoptSource = source(
      'src/pages/hosts/json-forms/HostSockoptForm.tsx',
    );

    expect(editorSource).toContain('ProfileRuntimeSockoptFields');
    expect(editorSource).not.toContain('function RuntimeSockoptFields(');
    expect(editorSource).toContain('network={effectiveNetwork}');

    for (const required of [
      'applyRealClientIpPreset',
      'createSockoptDefaults',
      'transportProxySettingsKey',
      'tcpKeepAliveInterval',
      'tcpKeepAliveIdle',
      'tcpMaxSeg',
      'tcpUserTimeout',
      'tcpWindowClamp',
      'acceptProxyProtocol',
      'tcpFastOpen',
      'penetrate',
      'V6Only',
      'tcpcongestion',
      'tproxy',
      'trustedXForwardedFor',
      'CustomSockoptList',
    ]) {
      expect(profileSockoptSource).toContain(required);
    }

    expect(inboundSockoptSource).toContain('sockopt-foundation');
    expect(simpleTransportSource).toContain(
      "'runtime', 'sockopt', 'acceptProxyProtocol'",
    );

    for (const listenerOnly of [
      'acceptProxyProtocol',
      'V6Only',
      'trustedXForwardedFor',
    ]) {
      expect(hostSockoptSource).toContain(listenerOnly);
    }
    expect(hostSockoptSource).toContain('serializeClientSockopt');
  });
});
