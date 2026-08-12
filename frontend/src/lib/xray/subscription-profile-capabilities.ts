import type { StreamSettings } from '@/schemas/api/inbound';
import type {
  ExternalProxyEntry,
  SubscriptionProfileSubType,
} from '@/schemas/protocols/stream/external-proxy';

export type SubscriptionProfileCapabilityCode =
  | 'client_sockopt'
  | 'profile_mux'
  | 'shuffle_host'
  | 'custom_headers'
  | 'websocket_heartbeat'
  | 'tcp_http_advanced'
  | 'grpc_advanced'
  | 'transport'
  | 'finalmask'
  | 'multiple_tls_pins'
  | 'reality_mldsa65'
  | 'reality_spiderx';

export interface SubscriptionProfileCapabilityIssue {
  format: SubscriptionProfileSubType;
  code: SubscriptionProfileCapabilityCode;
}

export const SUBSCRIPTION_PROFILE_CAPABILITY_TRANSLATION_KEYS: Record<
  SubscriptionProfileCapabilityCode,
  string
> = {
  client_sockopt: 'pages.inbounds.form.profileCapabilityClientSockopt',
  profile_mux: 'pages.inbounds.form.profileCapabilityMux',
  shuffle_host: 'pages.inbounds.form.profileCapabilityShuffleHost',
  custom_headers: 'pages.inbounds.form.profileCapabilityCustomHeaders',
  websocket_heartbeat: 'pages.inbounds.form.profileCapabilityWebSocketHeartbeat',
  tcp_http_advanced: 'pages.inbounds.form.profileCapabilityTcpHttpAdvanced',
  grpc_advanced: 'pages.inbounds.form.profileCapabilityGrpcAdvanced',
  transport: 'pages.inbounds.form.profileCapabilityTransport',
  finalmask: 'pages.inbounds.form.profileCapabilityFinalMask',
  multiple_tls_pins: 'pages.inbounds.form.profileCapabilityMultipleTlsPins',
  reality_mldsa65: 'pages.inbounds.form.profileCapabilityRealityMldsa',
  reality_spiderx: 'pages.inbounds.form.profileCapabilityRealitySpiderX',
};

const FORMATS: SubscriptionProfileSubType[] = ['raw', 'json', 'clash'];

type UnknownMap = Record<string, unknown>;

function asMap(value: unknown): UnknownMap | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as UnknownMap;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function hasNonEmptyMap(value: unknown): boolean {
  const map = asMap(value);
  return map !== undefined && Object.keys(map).length > 0;
}

function headerValuePresent(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.some(headerValuePresent);
  return value !== undefined && value !== null;
}

function hasNonHostHeaders(settings: unknown): boolean {
  const headers = asMap(asMap(settings)?.headers);
  if (!headers) return false;
  return Object.entries(headers).some(([key, value]) => (
    key.trim().toLowerCase() !== 'host' && headerValuePresent(value)
  ));
}

function nonZeroNumber(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value) && value !== 0;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) && parsed !== 0;
  }
  return false;
}


function hasFinalMaskContent(value: unknown): boolean {
  const finalmask = asMap(value);
  if (!finalmask) return false;
  if (Array.isArray(finalmask.tcp) && finalmask.tcp.length > 0) return true;
  if (Array.isArray(finalmask.udp) && finalmask.udp.length > 0) return true;
  const quic = asMap(finalmask.quicParams);
  return quic !== undefined && Object.keys(quic).length > 0;
}

function clashHysteriaFinalMaskUnrepresented(value: unknown): boolean {
  const finalmask = asMap(value);
  if (!finalmask) return false;

  if (Array.isArray(finalmask.tcp) && finalmask.tcp.length > 0) return true;

  if (Array.isArray(finalmask.udp)) {
    if (finalmask.udp.length > 1) return true;
    for (const rawMask of finalmask.udp) {
      const mask = asMap(rawMask);
      if (!mask || stringValue(mask.type) !== 'salamander') return true;
      const settings = asMap(mask.settings);
      if (settings && Object.entries(settings).some(([key, item]) => (
        key !== 'password' && headerValuePresent(item)
      ))) return true;
    }
  }

  const quic = asMap(finalmask.quicParams);
  if (quic) {
    if (Object.entries(quic).some(([key, item]) => (
      key !== 'udpHop' && headerValuePresent(item)
    ))) return true;
    const hop = asMap(quic.udpHop);
    if (hop && Object.entries(hop).some(([key, item]) => (
      key !== 'ports' && headerValuePresent(item)
    ))) return true;
  }

  return false;
}

function rawTcpHttpHasUnrepresentedFields(stream: UnknownMap): boolean {
  const tcp = asMap(stream.tcpSettings);
  const header = asMap(tcp?.header);
  if (stringValue(header?.type).toLowerCase() !== 'http') return false;

  const request = asMap(header?.request);
  if (request) {
    const version = stringValue(request.version);
    if (version && version !== '1.1') return true;
    const method = stringValue(request.method);
    if (method && method !== 'GET') return true;
    if (Array.isArray(request.path) && request.path.length > 1) return true;
    if (hasNonHostHeaders(request)) return true;
  }

  const response = asMap(header?.response);
  if (response) {
    const version = stringValue(response.version);
    if (version && version !== '1.1') return true;
    const status = stringValue(response.status);
    if (status && status !== '200') return true;
    const reason = stringValue(response.reason);
    if (reason && reason !== 'OK') return true;
    if (hasNonHostHeaders(response)) return true;
  }

  return false;
}

function tlsPins(stream: UnknownMap): unknown[] {
  const tls = asMap(stream.tlsSettings);
  const settings = asMap(tls?.settings);
  const pins = settings?.pinnedPeerCertSha256;
  if (Array.isArray(pins)) return pins.filter((pin) => stringValue(pin) !== '');
  if (typeof pins === 'string') {
    return pins.split(',').map((pin) => pin.trim()).filter(Boolean);
  }
  return [];
}

function codesForFormat(
  profile: ExternalProxyEntry,
  stream: UnknownMap,
  format: SubscriptionProfileSubType,
): SubscriptionProfileCapabilityCode[] {
  const codes: SubscriptionProfileCapabilityCode[] = [];
  const add = (code: SubscriptionProfileCapabilityCode) => {
    if (!codes.includes(code)) codes.push(code);
  };

  if (profile.shuffleHost === true) add('shuffle_host');

  const network = stringValue(stream.network).toLowerCase();
  const security = stringValue(stream.security).toLowerCase();

  if (format === 'json') return codes;

  if (hasNonEmptyMap(profile.sockopt)) add('client_sockopt');
  if (hasNonEmptyMap(profile.mux)) add('profile_mux');

  if (format === 'raw') {
    if (network === 'tcp' && rawTcpHttpHasUnrepresentedFields(stream)) {
      add('tcp_http_advanced');
    }
    if (network === 'ws') {
      const settings = asMap(stream.wsSettings);
      if (hasNonHostHeaders(settings)) add('custom_headers');
      if (nonZeroNumber(settings?.heartbeatPeriod)) add('websocket_heartbeat');
    }
    if (network === 'httpupgrade') {
      if (hasNonHostHeaders(stream.httpupgradeSettings)) add('custom_headers');
    }
    return codes;
  }

  if (
    hasFinalMaskContent(profile.finalmask)
    && (network !== 'hysteria' || clashHysteriaFinalMaskUnrepresented(profile.finalmask))
  ) add('finalmask');

  switch (network) {
    case '':
    case 'tcp': {
      const tcp = asMap(stream.tcpSettings);
      const header = asMap(tcp?.header);
      const headerType = stringValue(header?.type).toLowerCase();
      if (headerType && headerType !== 'none') add('transport');
      break;
    }
    case 'ws': {
      const settings = asMap(stream.wsSettings);
      if (hasNonHostHeaders(settings)) add('custom_headers');
      if (nonZeroNumber(settings?.heartbeatPeriod)) add('websocket_heartbeat');
      break;
    }
    case 'grpc': {
      const settings = asMap(stream.grpcSettings);
      if (stringValue(settings?.authority) || settings?.multiMode === true) {
        add('grpc_advanced');
      }
      break;
    }
    case 'httpupgrade':
      if (hasNonHostHeaders(stream.httpupgradeSettings)) add('custom_headers');
      break;
    case 'xhttp':
    case 'hysteria':
      break;
    default:
      add('transport');
      break;
  }

  if (security === 'tls' && tlsPins(stream).length > 1) {
    add('multiple_tls_pins');
  }

  if (security === 'reality') {
    const reality = asMap(stream.realitySettings);
    const settings = asMap(reality?.settings);
    if (stringValue(settings?.mldsa65Verify)) add('reality_mldsa65');
    const spiderX = stringValue(settings?.spiderX);
    if (spiderX && spiderX !== '/') add('reality_spiderx');
  }

  return codes;
}

export function subscriptionProfileCapabilityIssues(
  profile: ExternalProxyEntry | undefined,
  effectiveStream: StreamSettings | undefined,
): SubscriptionProfileCapabilityIssue[] {
  if (!profile || profile.enabled === false || !effectiveStream) return [];

  const excluded = new Set(profile.excludeFromSubTypes ?? []);
  const stream = effectiveStream as unknown as UnknownMap;
  const issues: SubscriptionProfileCapabilityIssue[] = [];

  for (const format of FORMATS) {
    if (excluded.has(format)) continue;
    for (const code of codesForFormat(profile, stream, format)) {
      issues.push({ format, code });
    }
  }

  return issues;
}
