import { describe, expect, it } from 'vitest';

import {
  subscriptionProfileCapabilityIssues,
} from '@/lib/xray/subscription-profile-capabilities';
import type { StreamSettings } from '@/schemas/api/inbound';
import type { ExternalProxyEntry } from '@/schemas/protocols/stream/external-proxy';

function profile(overrides: Record<string, unknown> = {}): ExternalProxyEntry {
  return {
    enabled: true,
    remark: '',
    dest: 'edge.example.com',
    port: 443,
    network: 'ws',
    security: 'tls',
    forceTls: 'same',
    ...overrides,
  } as ExternalProxyEntry;
}

function stream(value: Record<string, unknown>): StreamSettings {
  return value as unknown as StreamSettings;
}

describe('subscription profile format capabilities', () => {
  it('keeps JSON-only client controls explicit for Raw and Clash', () => {
    const current = profile({
      sockopt: { tcpFastOpen: true },
      mux: {
        enabled: true,
        concurrency: 4,
        xudpConcurrency: 8,
        xudpProxyUDP443: 'reject',
      },
      finalmask: { tcp: [{ type: 'fragment' }] },
    });
    const effective = stream({
      network: 'ws',
      security: 'tls',
      wsSettings: { path: '/ws', headers: { Host: 'edge.example.com' } },
      tlsSettings: { settings: { pinnedPeerCertSha256: [] } },
    });

    expect(subscriptionProfileCapabilityIssues(current, effective)).toEqual([
      { format: 'raw', code: 'client_sockopt' },
      { format: 'raw', code: 'profile_mux' },
      { format: 'clash', code: 'client_sockopt' },
      { format: 'clash', code: 'profile_mux' },
      { format: 'clash', code: 'finalmask' },
    ]);
  });

  it('detects transport fields that would otherwise be silently dropped', () => {
    const current = profile({ network: 'ws', security: 'none' });
    const effective = stream({
      network: 'ws',
      security: 'none',
      wsSettings: {
        path: '/ws',
        heartbeatPeriod: 15,
        headers: {
          Host: 'edge.example.com',
          'X-Profile': 'kept-only-by-json',
        },
      },
    });

    expect(subscriptionProfileCapabilityIssues(current, effective)).toEqual([
      { format: 'raw', code: 'custom_headers' },
      { format: 'raw', code: 'websocket_heartbeat' },
      { format: 'clash', code: 'custom_headers' },
      { format: 'clash', code: 'websocket_heartbeat' },
    ]);
  });

  it('accepts the supported Mihomo TLS and REALITY mappings', () => {
    const tlsProfile = profile({
      tlsSettings: {
        serverName: 'sni.example.com',
        alpn: ['h2'],
        settings: {
          fingerprint: 'chrome',
          echConfigList: 'ECH_CONFIG',
          pinnedPeerCertSha256: ['aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
          verifyPeerCertByName: 'verify.example.com',
          allowInsecure: false,
        },
      },
    });
    const tlsStream = stream({
      network: 'ws',
      security: 'tls',
      wsSettings: { path: '/ws', headers: {} },
      tlsSettings: tlsProfile.tlsSettings,
    });
    expect(subscriptionProfileCapabilityIssues(tlsProfile, tlsStream)).toEqual([]);

    const realityProfile = profile({
      network: 'xhttp',
      security: 'reality',
      mihomoX25519: true,
      realitySettings: {
        serverNames: ['reality.example.com'],
        shortIds: ['ab12'],
        settings: {
          publicKey: 'PUBLIC_KEY',
          fingerprint: 'chrome',
          serverName: 'reality.example.com',
          shortId: 'ab12',
          spiderX: '/',
          mldsa65Verify: '',
        },
      },
    });
    const realityStream = stream({
      network: 'xhttp',
      security: 'reality',
      xhttpSettings: { path: '/', mode: 'auto' },
      realitySettings: realityProfile.realitySettings,
    });
    expect(subscriptionProfileCapabilityIssues(realityProfile, realityStream)).toEqual([]);
  });

  it('blocks only Clash for unsupported security extensions', () => {
    const current = profile({
      network: 'xhttp',
      security: 'reality',
      realitySettings: {
        serverNames: ['reality.example.com'],
        shortIds: ['ab12'],
        settings: {
          publicKey: 'DO_NOT_LEAK_PUBLIC_VALUE',
          fingerprint: 'chrome',
          serverName: 'reality.example.com',
          shortId: 'ab12',
          spiderX: '/DO_NOT_LEAK_SPIDER_VALUE',
          mldsa65Verify: 'DO_NOT_LEAK_MLDSA_VALUE',
        },
      },
    });
    const effective = stream({
      network: 'xhttp',
      security: 'reality',
      xhttpSettings: { path: '/', mode: 'auto' },
      realitySettings: current.realitySettings,
    });

    const issues = subscriptionProfileCapabilityIssues(current, effective);
    expect(issues).toEqual([
      { format: 'clash', code: 'reality_mldsa65' },
      { format: 'clash', code: 'reality_spiderx' },
    ]);
    expect(JSON.stringify(issues)).not.toContain('DO_NOT_LEAK');
  });

  it('does not warn for formats the operator explicitly excluded', () => {
    const current = profile({
      sockopt: { tcpFastOpen: true },
      excludeFromSubTypes: ['raw', 'clash'],
    });
    const effective = stream({
      network: 'ws',
      security: 'tls',
      wsSettings: { path: '/ws', headers: {} },
      tlsSettings: { settings: {} },
    });

    expect(subscriptionProfileCapabilityIssues(current, effective)).toEqual([]);
  });
});
