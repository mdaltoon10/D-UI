import { describe, expect, it } from 'vitest';

import {
  createTcpHeaderForCamouflage,
  createTcpHttpCamouflageHeader,
} from '@/lib/xray/forms/transport/transport-foundation';
import {
  PROFILE_TRANSPORT_SETTING_KEYS,
  createProfileTransportDefaults,
  profileTransportSettingsKey,
} from '@/lib/xray/forms/transport/subscription-profile-transport';

describe('subscription profile transport foundation', () => {
  it('uses one canonical settings-key registry for supported profile transports', () => {
    expect(PROFILE_TRANSPORT_SETTING_KEYS).toEqual([
      'tcpSettings',
      'kcpSettings',
      'wsSettings',
      'grpcSettings',
      'httpupgradeSettings',
      'xhttpSettings',
    ]);
    expect(profileTransportSettingsKey('tcp')).toBe('tcpSettings');
    expect(profileTransportSettingsKey('ws')).toBe('wsSettings');
    expect(profileTransportSettingsKey('grpc')).toBe('grpcSettings');
    expect(profileTransportSettingsKey('httpupgrade')).toBe('httpupgradeSettings');
    expect(profileTransportSettingsKey('unknown')).toBeNull();
  });

  it('creates schema-backed defaults including transport proxy protocol', () => {
    expect(createProfileTransportDefaults('tcp')).toEqual({
      acceptProxyProtocol: false,
      header: { type: 'none' },
    });
    expect(createProfileTransportDefaults('ws')).toEqual({
      acceptProxyProtocol: false,
      path: '/',
      host: '',
      headers: {},
      heartbeatPeriod: 0,
    });
    expect(createProfileTransportDefaults('grpc')).toEqual({
      serviceName: '',
      authority: '',
      multiMode: false,
    });
    expect(createProfileTransportDefaults('httpupgrade')).toEqual({
      acceptProxyProtocol: false,
      path: '/',
      host: '',
      headers: {},
    });
  });

  it('shares exact RAW HTTP camouflage defaults between inbound and profile editors', () => {
    expect(createTcpHeaderForCamouflage(false)).toEqual({ type: 'none' });
    expect(createTcpHeaderForCamouflage(true)).toEqual({
      type: 'http',
      request: {
        version: '1.1',
        method: 'GET',
        path: ['/'],
        headers: {},
      },
      response: {
        version: '1.1',
        status: '200',
        reason: 'OK',
        headers: {},
      },
    });

    const first = createTcpHttpCamouflageHeader();
    const second = createTcpHttpCamouflageHeader();
    expect(first).not.toBe(second);
    expect(first.request).not.toBe(second.request);
    expect(first.response).not.toBe(second.response);
  });
});
