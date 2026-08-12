import { describe, expect, it } from 'vitest';

import {
  applyRealClientIpPreset,
  createSockoptDefaults,
  deriveRealClientIpPreset,
  transportProxySettingsKey,
  sockoptSupportsProxyProtocol,
  sockoptSupportsTrustedHeader,
} from '@/lib/xray/forms/transport/sockopt-foundation';

describe('subscription profile Sockopt foundation', () => {
  it('creates the same schema-backed listener defaults used by the inbound editor', () => {
    expect(createSockoptDefaults()).toMatchObject({
      acceptProxyProtocol: false,
      tcpFastOpen: false,
      mark: 0,
      tproxy: 'off',
      penetrate: false,
      tcpMaxSeg: 0,
      tcpKeepAliveInterval: 0,
      tcpKeepAliveIdle: 0,
      tcpUserTimeout: 0,
      tcpcongestion: 'bbr',
      V6Only: false,
      tcpWindowClamp: 0,
      trustedXForwardedFor: [],
      customSockopt: [],
    });
  });

  it('applies real-client-IP presets without discarding unrelated Sockopt tuning', () => {
    const cloudflare = applyRealClientIpPreset({
      preset: 'cloudflare',
      sockopt: {
        mark: 27,
        tcpKeepAliveIdle: 90,
        trustedXForwardedFor: ['X-Real-IP'],
        acceptProxyProtocol: true,
      },
    });

    expect(cloudflare.sockopt).toMatchObject({
      mark: 27,
      tcpKeepAliveIdle: 90,
      acceptProxyProtocol: false,
      trustedXForwardedFor: ['X-Real-IP', 'CF-Connecting-IP'],
    });
    expect(cloudflare.transportAcceptProxyProtocol).toBe(false);

    const proxy = applyRealClientIpPreset({
      preset: 'proxy',
      sockopt: cloudflare.sockopt,
    });
    expect(proxy.sockopt).toMatchObject({
      mark: 27,
      acceptProxyProtocol: true,
      trustedXForwardedFor: [],
    });
    expect(proxy.transportAcceptProxyProtocol).toBe(true);

    const off = applyRealClientIpPreset({
      preset: 'off',
      sockopt: proxy.sockopt,
    });
    expect(off.sockopt.acceptProxyProtocol).toBe(false);
    expect(off.sockopt.trustedXForwardedFor).toEqual([]);
    expect(off.sockopt.mark).toBe(27);
  });

  it('derives presets and transport capabilities deterministically', () => {
    expect(deriveRealClientIpPreset({
      sockopt: { trustedXForwardedFor: ['CF-Connecting-IP'] },
    })).toBe('cloudflare');
    expect(deriveRealClientIpPreset({
      sockopt: { trustedXForwardedFor: ['CF-Connecting-IP'] },
      transportAcceptProxyProtocol: true,
    })).toBe('proxy');
    expect(deriveRealClientIpPreset({ sockopt: undefined })).toBe('off');

    expect(transportProxySettingsKey('tcp')).toBe('tcpSettings');
    expect(transportProxySettingsKey('ws')).toBe('wsSettings');
    expect(transportProxySettingsKey('httpupgrade')).toBe('httpupgradeSettings');
    expect(transportProxySettingsKey('grpc')).toBeNull();
    expect(transportProxySettingsKey('xhttp')).toBeNull();

    expect(sockoptSupportsTrustedHeader('ws')).toBe(true);
    expect(sockoptSupportsTrustedHeader('grpc')).toBe(true);
    expect(sockoptSupportsTrustedHeader('tcp')).toBe(false);
    expect(sockoptSupportsProxyProtocol('xhttp')).toBe(true);
    expect(sockoptSupportsProxyProtocol('kcp')).toBe(false);
  });
});
