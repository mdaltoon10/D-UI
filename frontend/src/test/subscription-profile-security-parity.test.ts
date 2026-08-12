import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

function source(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

describe('subscription profile Phase 2C security parity wiring', () => {
  it('routes client and runtime security through extracted shared profile components', () => {
    const editor = source(
      'src/pages/inbounds/form/transport/subscription-profile-editor.tsx',
    );
    const fields = source(
      'src/pages/inbounds/form/transport/subscription-profile-security-fields.tsx',
    );
    const actions = source(
      'src/pages/inbounds/form/transport/use-subscription-profile-security-actions.ts',
    );

    expect(editor).toContain('ProfileClientSecurityFields');
    expect(editor).toContain('ProfileRuntimeServerSecurityFields');
    expect(editor).toContain('useSubscriptionProfileSecurityActions');
    expect(editor).not.toContain('function SecuritySettingsFields(');
    expect(editor).not.toContain('function RuntimeServerSecurityFields(');

    for (const required of [
      'cipherSuites',
      'curvePreferences',
      'disableSystemRoot',
      'enableSessionResumption',
      'certificates',
      'certificateFile',
      'certificateContent',
      'ocspStapling',
      'oneTimeLoading',
      'buildChain',
      'masterKeyLog',
      'echSockopt',
      'echServerKeys',
      'pinnedPeerCertSha256',
      'verifyPeerCertByName',
      'RealityTargetScannerModal',
      'maxTimediff',
      'minClientVer',
      'maxClientVer',
      'mldsa65Seed',
      'mldsa65Verify',
      'limitFallbackUpload',
      'limitFallbackDownload',
      'preferredRealitySni',
      'preferredRealityShortId',
    ]) {
      expect(fields).toContain(required);
    }

    for (const endpoint of [
      '/panel/api/server/getRemoteCertHash',
      '/panel/api/server/getCertHash',
      '/panel/api/server/getNewEchCert',
      '/panel/api/server/getNewX25519Cert',
      '/panel/api/server/getNewmldsa65',
      '/panel/api/server/scanRealityTarget',
      '/panel/api/server/scanRealityTargets',
    ]) {
      expect(actions).toContain(endpoint);
    }
  });

  it('keeps client and server secret material in separate form paths', () => {
    const actions = source(
      'src/pages/inbounds/form/transport/use-subscription-profile-security-actions.ts',
    );

    expect(actions).toContain("runtimeRealityPath('privateKey')");
    expect(actions).toContain("clientRealityPath('settings', 'publicKey')");
    expect(actions).toContain("runtimeRealityPath('mldsa65Seed')");
    expect(actions).toContain("clientRealityPath('settings', 'mldsa65Verify')");
    expect(actions).toContain("runtimeTlsPath('echServerKeys')");
    expect(actions).toContain("clientTlsPath('settings', 'echConfigList')");
  });
});
