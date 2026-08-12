import {
  SockoptStreamSettingsSchema,
  type SockoptStreamSettings,
} from '@/schemas/protocols/stream/sockopt';

export type RealClientIpPreset = 'off' | 'cloudflare' | 'proxy';

// Xray reads trusted forwarded-IP headers only on HTTP-shaped transports.
// The pinned custom core also supports this on gRPC.
export const SOCKOPT_TRUSTED_HEADER_NETWORKS = [
  'ws',
  'httpupgrade',
  'xhttp',
  'grpc',
] as const;

// Subscription profiles expose TCP, mKCP, WS, gRPC, HTTPUpgrade and XHTTP.
// Of those, mKCP is the only transport that cannot consume PROXY protocol.
export const SOCKOPT_PROXY_PROTOCOL_NETWORKS = [
  'tcp',
  'ws',
  'httpupgrade',
  'xhttp',
  'grpc',
] as const;

export const SOCKOPT_TRUSTED_HEADER_OPTIONS = [
  'CF-Connecting-IP',
  'X-Real-IP',
  'True-Client-IP',
  'X-Client-IP',
] as const;

export const SOCKOPT_TCP_CONGESTION_OPTIONS = ['bbr', 'cubic', 'reno'] as const;

export const SOCKOPT_TPROXY_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'redirect', label: 'Redirect' },
  { value: 'tproxy', label: 'TProxy' },
] as const;

// These transports duplicate acceptProxyProtocol in their own settings object.
// Keep that field synchronized with sockopt.acceptProxyProtocol.
const TRANSPORT_PROXY_SETTINGS_KEY = {
  tcp: 'tcpSettings',
  ws: 'wsSettings',
  httpupgrade: 'httpupgradeSettings',
} as const;

export type TransportProxySettingsKey =
  (typeof TRANSPORT_PROXY_SETTINGS_KEY)[keyof typeof TRANSPORT_PROXY_SETTINGS_KEY];

export type SockoptDraft = SockoptStreamSettings & Record<string, unknown>;

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

export function createSockoptDefaults(): SockoptDraft {
  return SockoptStreamSettingsSchema.parse({}) as SockoptDraft;
}

export function transportProxySettingsKey(
  network: string,
): TransportProxySettingsKey | null {
  return TRANSPORT_PROXY_SETTINGS_KEY[
    network as keyof typeof TRANSPORT_PROXY_SETTINGS_KEY
  ] ?? null;
}

export function sockoptSupportsTrustedHeader(network: string): boolean {
  return (SOCKOPT_TRUSTED_HEADER_NETWORKS as readonly string[]).includes(network);
}

export function sockoptSupportsProxyProtocol(network: string): boolean {
  return (SOCKOPT_PROXY_PROTOCOL_NETWORKS as readonly string[]).includes(network);
}

export function deriveRealClientIpPreset({
  sockopt,
  transportAcceptProxyProtocol = false,
}: {
  sockopt: unknown;
  transportAcceptProxyProtocol?: boolean;
}): RealClientIpPreset {
  const current = asRecord(sockopt);
  const proxyEnabled = current.acceptProxyProtocol === true
    || transportAcceptProxyProtocol;
  if (proxyEnabled) return 'proxy';
  if (stringList(current.trustedXForwardedFor).length > 0) return 'cloudflare';
  return 'off';
}

export function applyRealClientIpPreset({
  sockopt,
  preset,
}: {
  sockopt: unknown;
  preset: RealClientIpPreset;
}): {
  sockopt: SockoptDraft;
  transportAcceptProxyProtocol: boolean;
} {
  const current = asRecord(sockopt);
  const next = {
    ...createSockoptDefaults(),
    ...current,
  } as SockoptDraft;

  if (preset === 'off') {
    next.trustedXForwardedFor = [];
    next.acceptProxyProtocol = false;
    return {
      sockopt: next,
      transportAcceptProxyProtocol: false,
    };
  }

  if (preset === 'cloudflare') {
    const trusted = stringList(current.trustedXForwardedFor);
    if (!trusted.includes('CF-Connecting-IP')) trusted.push('CF-Connecting-IP');
    next.trustedXForwardedFor = trusted;
    next.acceptProxyProtocol = false;
    return {
      sockopt: next,
      transportAcceptProxyProtocol: false,
    };
  }

  next.trustedXForwardedFor = [];
  next.acceptProxyProtocol = true;
  return {
    sockopt: next,
    transportAcceptProxyProtocol: true,
  };
}
