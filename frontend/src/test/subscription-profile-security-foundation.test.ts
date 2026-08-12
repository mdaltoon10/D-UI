import { describe, expect, it } from 'vitest';

import {
  createProfileRuntimeRealityDefaults,
  createProfileRuntimeTlsDefaults,
  isClientVersionRangeValid,
  isClientVersionValid,
  isRealityShortIdValid,
  isTlsVersionRangeValid,
  mergeUniqueSecurityValues,
  pemLinesToText,
  pemTextToLines,
  remoteCertificateTarget,
  resolvePreferredRealityValue,
} from '@/lib/xray/forms/security';

describe('subscription profile security foundation', () => {
  it('selects explicit valid REALITY preferences and deterministic fallbacks', () => {
    expect(resolvePreferredRealityValue(['first', 'preferred'], 'preferred')).toBe('preferred');
    expect(resolvePreferredRealityValue(['first', 'second'], 'missing')).toBe('first');
    expect(resolvePreferredRealityValue([], 'explicit')).toBe('explicit');
    expect(resolvePreferredRealityValue([], '')).toBe('');
  });

  it('merges certificate hashes without empty values or duplicates', () => {
    expect(mergeUniqueSecurityValues(['aa', ' aa ', ''], ['bb', 'aa'])).toEqual(['aa', 'bb']);
  });

  it('builds a remote certificate target from SNI/address and port', () => {
    expect(remoteCertificateTarget('tls.example', '203.0.113.10', 8443)).toBe('tls.example:8443');
    expect(remoteCertificateTarget('', '203.0.113.10', 443)).toBe('203.0.113.10:443');
    expect(remoteCertificateTarget('tls.example:9443', '', 443)).toBe('tls.example:9443');
    expect(remoteCertificateTarget('', '', 443)).toBe('');
  });

  it('creates full runtime TLS and REALITY defaults for profile-owned listeners', () => {
    const tls = createProfileRuntimeTlsDefaults();
    expect(tls).toMatchObject({
      minVersion: '1.2',
      maxVersion: '1.3',
      rejectUnknownSni: false,
      disableSystemRoot: false,
      enableSessionResumption: false,
      alpn: ['h2', 'http/1.1'],
    });
    expect(tls.certificates).toHaveLength(1);

    const reality = createProfileRuntimeRealityDefaults();
    expect(reality).toMatchObject({
      show: false,
      xver: 0,
      target: '',
      serverNames: [],
      shortIds: [],
      maxTimediff: 0,
    });
  });

  it('validates TLS ranges, REALITY short IDs and optional client versions', () => {
    expect(isTlsVersionRangeValid('1.2', '1.3')).toBe(true);
    expect(isTlsVersionRangeValid('1.3', '1.2')).toBe(false);
    expect(isRealityShortIdValid('0123abcd')).toBe(true);
    expect(isRealityShortIdValid('not-hex')).toBe(false);
    expect(isClientVersionValid('26.3.27')).toBe(true);
    expect(isClientVersionValid('')).toBe(true);
    expect(isClientVersionValid('v26-beta')).toBe(false);
    expect(isClientVersionRangeValid('25.9.11', '26.3.27')).toBe(true);
    expect(isClientVersionRangeValid('26.3.27', '25.9.11')).toBe(false);
    expect(isClientVersionRangeValid('', '25.9.11')).toBe(true);
  });

  it('round-trips inline PEM line arrays through the profile editor transform', () => {
    const lines = ['-----BEGIN CERTIFICATE-----', 'abc', '-----END CERTIFICATE-----'];
    expect(pemTextToLines(pemLinesToText(lines))).toEqual(lines);
  });
});
