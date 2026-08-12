import { describe, expect, it } from 'vitest';

import {
  createFreshXhttpXmux,
  isValidXhttpScalarOrRange,
  prepareXhttpSettingsForMode,
  sanitizeXhttpSettings,
  xhttpModeVisibility,
  xhttpPlacementRequiresKey,
} from '@/lib/xray/forms/transport/xhttp-foundation';
import { createProfileTransportDefaults } from '@/lib/xray/forms/transport/subscription-profile-transport';

describe('subscription profile xHTTP foundation', () => {
  it('exposes the exact mode-dependent field matrix', () => {
    expect(xhttpModeVisibility('auto')).toEqual({
      maxUploadSize: true,
      maxBufferedUpload: true,
      minUploadInterval: true,
      streamUpServer: false,
      uplinkDataPlacement: false,
    });
    expect(xhttpModeVisibility('packet-up')).toEqual({
      maxUploadSize: true,
      maxBufferedUpload: true,
      minUploadInterval: true,
      streamUpServer: false,
      uplinkDataPlacement: true,
    });
    expect(xhttpModeVisibility('stream-up')).toEqual({
      maxUploadSize: false,
      maxBufferedUpload: true,
      minUploadInterval: false,
      streamUpServer: true,
      uplinkDataPlacement: false,
    });
    expect(xhttpModeVisibility('stream-one')).toEqual({
      maxUploadSize: false,
      maxBufferedUpload: false,
      minUploadInterval: false,
      streamUpServer: false,
      uplinkDataPlacement: false,
    });
    expect(xhttpModeVisibility('invalid')).toEqual(xhttpModeVisibility('auto'));
  });

  it('validates non-negative scalar and ordered range values', () => {
    for (const value of ['', 0, 30, '30', '50-150', ' 50 - 150 ']) {
      expect(isValidXhttpScalarOrRange(value), String(value)).toBe(true);
    }
    for (const value of ['-1', '150-50', '1.5', '1-2-3', 'abc']) {
      expect(isValidXhttpScalarOrRange(value), String(value)).toBe(false);
    }
  });

  it('applies mode defaults and removes inactive mode fields', () => {
    const stale = {
      mode: 'packet-up',
      scMaxEachPostBytes: '1024',
      scMaxBufferedPosts: 30,
      scMinPostsIntervalMs: '50-150',
      scStreamUpServerSecs: '20-80',
      uplinkDataPlacement: 'header',
      uplinkDataKey: 'x_data',
      uplinkHTTPMethod: 'GET',
    };

    expect(prepareXhttpSettingsForMode(stale, 'stream-up')).toMatchObject({
      mode: 'stream-up',
      scMaxBufferedPosts: 30,
      scStreamUpServerSecs: '20-80',
    });
    const streamUp = prepareXhttpSettingsForMode(stale, 'stream-up');
    expect(streamUp).not.toHaveProperty('scMaxEachPostBytes');
    expect(streamUp).not.toHaveProperty('scMinPostsIntervalMs');
    expect(streamUp).not.toHaveProperty('uplinkDataPlacement');
    expect(streamUp).not.toHaveProperty('uplinkDataKey');
    expect(streamUp).not.toHaveProperty('uplinkHTTPMethod');

    const streamOne = prepareXhttpSettingsForMode(stale, 'stream-one');
    expect(streamOne).not.toHaveProperty('scMaxEachPostBytes');
    expect(streamOne).not.toHaveProperty('scMaxBufferedPosts');
    expect(streamOne).not.toHaveProperty('scMinPostsIntervalMs');
    expect(streamOne).not.toHaveProperty('scStreamUpServerSecs');
  });

  it('canonicalizes legacy session fields and removes inactive toggle values', () => {
    const cleaned = sanitizeXhttpSettings({
      mode: 'packet-up',
      xPaddingObfsMode: false,
      xPaddingKey: 'stale',
      xPaddingHeader: 'stale',
      xPaddingPlacement: 'header',
      xPaddingMethod: 'tokenish',
      sessionPlacement: 'path',
      sessionKey: 'stale',
      sessionIDTable: '',
      sessionIDLength: '8-16',
      seqPlacement: 'path',
      seqKey: 'stale',
      uplinkDataPlacement: 'body',
      uplinkDataKey: 'stale',
      enableXmux: true,
    });

    expect(cleaned.sessionIDPlacement).toBe('path');
    expect(cleaned).not.toHaveProperty('sessionPlacement');
    expect(cleaned).not.toHaveProperty('sessionKey');
    expect(cleaned).not.toHaveProperty('sessionIDKey');
    expect(cleaned).not.toHaveProperty('sessionIDLength');
    expect(cleaned).not.toHaveProperty('seqKey');
    expect(cleaned).not.toHaveProperty('uplinkDataKey');
    expect(cleaned).not.toHaveProperty('xPaddingKey');
    expect(cleaned).not.toHaveProperty('xPaddingHeader');
    expect(cleaned).not.toHaveProperty('xPaddingPlacement');
    expect(cleaned).not.toHaveProperty('xPaddingMethod');
    expect(cleaned).not.toHaveProperty('enableXmux');
  });

  it('uses schema defaults and the requested fresh XMUX strategy', () => {
    const defaults = createProfileTransportDefaults('xhttp');
    expect(defaults).toMatchObject({
      host: '',
      path: '/',
      mode: 'auto',
      scMaxEachPostBytes: '',
      scMaxBufferedPosts: 30,
      scMinPostsIntervalMs: '',
      scStreamUpServerSecs: '20-80',
      serverMaxHeaderBytes: 0,
      xPaddingBytes: '100-1000',
      xPaddingObfsMode: false,
      noSSEHeader: false,
      headers: {},
    });

    const first = createFreshXhttpXmux();
    const second = createFreshXhttpXmux();
    expect(first).toEqual({
      maxConcurrency: '',
      maxConnections: 6,
      cMaxReuseTimes: 0,
      hMaxRequestTimes: '600-900',
      hMaxReusableSecs: '1800-3000',
      hKeepAlivePeriod: 0,
    });
    expect(first).not.toBe(second);
  });

  it('requires placement keys only for header, cookie and query', () => {
    expect(xhttpPlacementRequiresKey('header')).toBe(true);
    expect(xhttpPlacementRequiresKey('cookie')).toBe(true);
    expect(xhttpPlacementRequiresKey('query')).toBe(true);
    expect(xhttpPlacementRequiresKey('path')).toBe(false);
    expect(xhttpPlacementRequiresKey('body')).toBe(false);
    expect(xhttpPlacementRequiresKey('')).toBe(false);
  });
});
