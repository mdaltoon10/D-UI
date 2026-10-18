import { describe, expect, it } from 'vitest';
import { isOutboundProtocol, OutboundProtocols } from '@/schemas/primitives';

describe('isOutboundProtocol', () => {
  it('correctly validates protocol string without throwing ReferenceError', () => {
    expect(isOutboundProtocol('freedom')).toBe(true);
    expect(isOutboundProtocol('VMess')).toBe(true);
    expect(isOutboundProtocol('wireguard')).toBe(true);
    expect(isOutboundProtocol('unknown-protocol')).toBe(false);
    expect(isOutboundProtocol(null)).toBe(false);
    expect(isOutboundProtocol(undefined)).toBe(false);
    expect(isOutboundProtocol(123)).toBe(false);
  });

  it('correctly matches targetProtocol when specified', () => {
    expect(isOutboundProtocol('freedom', 'freedom')).toBe(true);
    expect(isOutboundProtocol('FREEDOM', 'freedom')).toBe(true);
    expect(isOutboundProtocol('freedom', 'vmess')).toBe(false);
    expect(isOutboundProtocol({ protocol: 'wireguard' }, 'wireguard')).toBe(true);
    expect(isOutboundProtocol({ protocol: 'Wireguard' }, 'wireguard')).toBe(true);
    expect(isOutboundProtocol({ protocol: 'freedom' }, 'blackhole')).toBe(false);
    expect(isOutboundProtocol({}, 'freedom')).toBe(false);
    expect(isOutboundProtocol(null, 'freedom')).toBe(false);
  });

  it('recognizes all declared OutboundProtocols', () => {
    for (const proto of Object.values(OutboundProtocols)) {
      expect(isOutboundProtocol(proto)).toBe(true);
      expect(isOutboundProtocol({ protocol: proto })).toBe(true);
      expect(isOutboundProtocol(proto, proto)).toBe(true);
    }
  });
});
