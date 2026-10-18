export const OutboundProtocols = Object.freeze({
  Freedom: 'freedom',
  Blackhole: 'blackhole',
  DNS: 'dns',
  VMess: 'vmess',
  VLESS: 'vless',
  Trojan: 'trojan',
  Shadowsocks: 'shadowsocks',
  Wireguard: 'wireguard',
  Hysteria: 'hysteria',
  Socks: 'socks',
  HTTP: 'http',
  Loopback: 'loopback',
});

export const OutboundDomainStrategies = Object.freeze([
  'AsIs',
  'UseIP',
  'UseIPv4',
  'UseIPv6',
  'UseIPv6v4',
  'UseIPv4v6',
  'ForceIP',
  'ForceIPv6v4',
  'ForceIPv6',
  'ForceIPv4v6',
  'ForceIPv4',
] as const);

export type OutboundDomainStrategy = (typeof OutboundDomainStrategies)[number];

export function isOutboundProtocol(value: unknown, targetProtocol?: string): boolean {
  const proto =
    typeof value === 'string'
      ? value
      : typeof (value as any)?.protocol === 'string'
        ? (value as any).protocol
        : undefined;

  if (typeof proto !== 'string') {
    return false;
  }

  const normalized = proto.toLowerCase();
  if (targetProtocol !== undefined) {
    return normalized === targetProtocol.toLowerCase();
  }

  return Object.values(OutboundProtocols).some(
    (p) => typeof p === 'string' && p.toLowerCase() === normalized,
  );
}
