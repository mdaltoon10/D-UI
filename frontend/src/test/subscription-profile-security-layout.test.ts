import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

function source(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

function expectOrdered(value: string, markers: string[]) {
  let cursor = -1;
  for (const marker of markers) {
    const next = value.indexOf(marker, cursor + 1);
    expect(next, `missing or out-of-order marker: ${marker}`).toBeGreaterThan(cursor);
    cursor = next;
  }
}

describe('subscription profile security layout', () => {
  it('uses an inbound-style segmented security selector and compact status rows', () => {
    const editor = source(
      'src/pages/inbounds/form/transport/subscription-profile-editor.tsx',
    );

    expect(editor).toContain('ext-proxy-section--security');
    expect(editor).toContain('ext-proxy-security-mode');
    expect(editor).toContain('<Radio.Group');
    expect(editor).toContain('optionType="button"');
    expect(editor).toContain('<ProfileSecurityStatus tone="success">');
  });

  it('separates client settings from the server override without grid mixing', () => {
    const fields = source(
      'src/pages/inbounds/form/transport/subscription-profile-security-fields.tsx',
    );

    expect(fields).toContain('ext-proxy-security-block--client');
    expect(fields).toContain('ext-proxy-security-block--server');
    expect(fields).toContain('ext-proxy-security-block__description');
    expect(fields).toContain('ext-proxy-security-override');
    expect(fields).not.toContain('ext-proxy-grid ext-proxy-grid--three');
    expect(fields).not.toContain('ext-proxy-grid ext-proxy-grid--two');
  });

  it('keeps the runtime TLS controls in inbound reference order', () => {
    const fields = source(
      'src/pages/inbounds/form/transport/subscription-profile-security-fields.tsx',
    );
    const start = fields.indexOf('function ProfileRuntimeTlsFields(');
    const end = fields.indexOf('interface ProfileTlsCertificateRowProps', start);
    const tls = fields.slice(start, end);

    expectOrdered(tls, [
      "'cipherSuites'",
      "'minVersion'",
      "'maxVersion'",
      "'alpn'",
      "'curvePreferences'",
      "'rejectUnknownSni'",
      "'disableSystemRoot'",
      "'enableSessionResumption'",
      "'certificates'",
      "'masterKeyLog'",
      "'echSockopt'",
      "'echServerKeys'",
    ]);
  });

  it('keeps runtime REALITY controls in the inbound reference flow', () => {
    const fields = source(
      'src/pages/inbounds/form/transport/subscription-profile-security-fields.tsx',
    );
    const start = fields.indexOf('function ProfileRuntimeRealityFields(');
    const reality = fields.slice(start);

    expectOrdered(reality, [
      "'show'",
      "'xver'",
      "'target'",
      "'maxTimediff'",
      "'minClientVer'",
      "'maxClientVer'",
      "'shortIds'",
      "'privateKey'",
      "'mldsa65Seed'",
      "'masterKeyLog'",
      "'limitFallbackUpload'",
      "'limitFallbackDownload'",
    ]);
  });

  it('uses client SNI as the single visible source for TLS and REALITY', () => {
    const fields = source(
      'src/pages/inbounds/form/transport/subscription-profile-security-fields.tsx',
    );
    const tlsStart = fields.indexOf('function ProfileRuntimeTlsFields(');
    const tlsEnd = fields.indexOf('interface ProfileTlsCertificateRowProps', tlsStart);
    const runtimeTls = fields.slice(tlsStart, tlsEnd);
    const realityStart = fields.indexOf('function ProfileRuntimeRealityFields(');
    const runtimeReality = fields.slice(realityStart);

    expect(runtimeTls).not.toContain(
      "name={[fieldName, 'runtime', 'tlsSettings', 'serverName']}",
    );
    expect(runtimeReality).not.toContain(
      "name={[fieldName, 'runtime', 'realitySettings', 'serverNames']}",
    );
    expect(fields).toContain(
      "name={[fieldName, 'tlsSettings', 'serverName']}",
    );
    expect(fields).toContain(
      "name={[fieldName, 'realitySettings', 'serverNames']}",
    );
    expect(fields).toContain('runtimeTlsServerName !== effectiveClientSni');
    expect(fields).toContain('!sameStringList(serverNames, clientNames)');
  });

  it('retains strict client/server secret ownership', () => {
    const fields = source(
      'src/pages/inbounds/form/transport/subscription-profile-security-fields.tsx',
    );

    expect(fields.match(/'tlsSettings', 'settings', 'echConfigList'/g)).toHaveLength(1);
    expect(fields.match(/'runtime', 'tlsSettings', 'echServerKeys'/g)).toHaveLength(1);
    expect(fields.match(/'realitySettings', 'settings', 'publicKey'/g)).toHaveLength(1);
    expect(fields.match(/'runtime', 'realitySettings', 'privateKey'/g)).toHaveLength(1);
    expect(fields.match(/'realitySettings', 'settings', 'mldsa65Verify'/g)).toHaveLength(1);
    expect(fields.match(/'runtime', 'realitySettings', 'mldsa65Seed'/g)).toHaveLength(1);
  });

  it('defines responsive, RTL-safe and theme-token-based security styles', () => {
    const styles = source(
      'src/pages/inbounds/form/transport/external-proxy.css',
    );

    for (const marker of [
      '.ext-proxy-security-mode',
      '.ext-proxy-security-block',
      '.ext-proxy-security-status',
      '.ext-proxy-security-target',
      '.ext-proxy-security-collapse',
      '@media (max-width: 768px)',
      '@media (max-width: 575px)',
      '@media (max-width: 380px)',
      'margin-inline-start',
      'border-inline-start',
      'var(--ant-color-bg-container)',
    ]) {
      expect(styles).toContain(marker);
    }
  });
});
