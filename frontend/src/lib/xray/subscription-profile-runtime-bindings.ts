import type { StreamSettings } from '@/schemas/api/inbound';
import type { ExternalProxyEntry } from '@/schemas/protocols/stream/external-proxy';
import { profileTransportSettingsKey } from '@/lib/xray/forms/transport/subscription-profile-transport';
import {
  effectiveSubscriptionProfileFinalMask,
  effectiveSubscriptionProfileStream,
  hasAutomaticRuntimeMarker,
  isModernSubscriptionProfile,
} from '@/lib/xray/subscription-profile';

// Client-side mirror of the backend's selector-aware runtime topology planner.
// The backend remains canonical. This module exists to explain automatic
// Direct/Shared behavior and block deterministic ambiguity before Save.
export type SubscriptionRuntimeConflictKind = 'parent' | 'profile';
export type SubscriptionRuntimePlanMode = 'alias' | 'direct' | 'shared' | 'invalid';
export type SubscriptionRuntimeIssueCode =
  | 'listen_overlap'
  | 'udp_duplicate'
  | 'missing_sni'
  | 'invalid_sni'
  | 'ech_unsupported'
  | 'duplicate_sni'
  | 'multiple_raw'
  | 'multiple_http2'
  | 'cleartext_xhttp'
  | 'http_selector_overlap'
  | 'invalid_http_selector'
  | 'unsupported_transport';

export interface SubscriptionRuntimeConflict {
  profileIndex: number;
  kind: SubscriptionRuntimeConflictKind;
  otherProfileIndex?: number;
  listen: string;
  port: number;
  transport: 'tcp' | 'udp';
  code: SubscriptionRuntimeIssueCode;
  detail: string;
}

export interface SubscriptionRuntimeProfilePlan {
  profileIndex: number;
  mode: SubscriptionRuntimePlanMode;
  listen: string;
  port: number;
  transport: 'tcp' | 'udp';
  issue?: SubscriptionRuntimeConflict;
}

export interface SubscriptionRuntimeTopologyPlan {
  profiles: SubscriptionRuntimeProfilePlan[];
  conflicts: SubscriptionRuntimeConflict[];
}

export interface SubscriptionRuntimeConflictInput {
  parentListen: string;
  parentPort: number;
  parentStreamSettings: Partial<StreamSettings>;
  profiles: ExternalProxyEntry[];
}

interface RuntimeEndpoint {
  profileIndex: number | null;
  listen: string;
  port: number;
  transport: 'tcp' | 'udp';
  network: string;
  security: string;
  stream: Partial<StreamSettings>;
  profile: ExternalProxyEntry | null;
}

interface RuntimeRouteSelector {
  kind: 'tls-sni' | 'http1' | 'http2-preface' | 'raw-catch-all';
  sni?: string;
  hosts?: string[];
  paths?: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function valuesDeepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false;
    }
    return left.every((value, index) => valuesDeepEqual(value, right[index]));
  }
  if (isRecord(left) || isRecord(right)) {
    if (!isRecord(left) || !isRecord(right)) return false;
    const leftKeys = Object.keys(left).filter((key) => left[key] !== undefined).sort();
    const rightKeys = Object.keys(right).filter((key) => right[key] !== undefined).sort();
    if (!valuesDeepEqual(leftKeys, rightKeys)) return false;
    return leftKeys.every((key) => valuesDeepEqual(left[key], right[key]));
  }
  return false;
}

function canonicalIPv4(value: string): string | null {
  const parts = value.split('.');
  if (parts.length !== 4) return null;
  const normalized: string[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    if (part.length > 1 && part.startsWith('0')) return null;
    const number = Number(part);
    if (number < 0 || number > 255) return null;
    normalized.push(String(number));
  }
  return normalized.join('.');
}

function canonicalIPLiteral(value: string): string | null {
  const candidate = value.trim().replace(/^\[|\]$/g, '');
  const ipv4 = canonicalIPv4(candidate);
  if (ipv4) return ipv4;
  if (!candidate.includes(':')) return null;
  try {
    const hostname = new URL(`http://[${candidate}]/`).hostname;
    const canonical = hostname.replace(/^\[|\]$/g, '').toLowerCase();
    const mapped = canonical.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (mapped) {
      const high = Number.parseInt(mapped[1], 16);
      const low = Number.parseInt(mapped[2], 16);
      return [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.');
    }
    return canonical;
  } catch {
    return null;
  }
}

function normalizeRuntimeListenForComparison(value: string): string {
  const trimmed = value.trim();
  if (trimmed === '') return '0.0.0.0';
  return canonicalIPLiteral(trimmed) ?? trimmed;
}

function runtimeListenOverlaps(left: string, right: string): boolean {
  const normalizedLeft = normalizeRuntimeListenForComparison(left);
  const normalizedRight = normalizeRuntimeListenForComparison(right);
  if (
    normalizedLeft === '0.0.0.0'
    || normalizedLeft === '::'
    || normalizedRight === '0.0.0.0'
    || normalizedRight === '::'
  ) {
    return true;
  }
  return normalizedLeft === normalizedRight;
}

function runtimeTransportFamily(network: string): 'tcp' | 'udp' {
  return network === 'kcp' || network === 'hysteria' ? 'udp' : 'tcp';
}

function effectiveProfileNetwork(
  parentStreamSettings: Partial<StreamSettings>,
  profile: ExternalProxyEntry,
): string {
  const parentNetwork = parentStreamSettings.network || 'tcp';
  return profile.network && profile.network !== 'same'
    ? profile.network
    : parentNetwork;
}

function effectiveProfileSecurity(
  parentStreamSettings: Partial<StreamSettings>,
  profile: ExternalProxyEntry,
): string {
  if (profile.security && profile.security !== 'same') return profile.security;
  if (profile.forceTls && profile.forceTls !== 'same') return profile.forceTls;
  return parentStreamSettings.security || 'none';
}

function withoutClientSecuritySettings(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const serverSettings = { ...value };
  delete serverSettings.settings;
  return serverSettings;
}

function runtimeProfileReusesParentListener(
  parentStreamSettings: Partial<StreamSettings>,
  profile: ExternalProxyEntry,
): boolean {
  const parentNetwork = parentStreamSettings.network || 'tcp';
  const network = effectiveProfileNetwork(parentStreamSettings, profile);
  if (network !== parentNetwork) return false;

  const parentStreamRecord = parentStreamSettings as unknown as Record<string, unknown>;
  const parentTlsSettings = parentStreamRecord.tlsSettings;
  const parentRealitySettings = parentStreamRecord.realitySettings;
  const settingsKey = profileTransportSettingsKey(network);
  if (settingsKey && network !== 'kcp' && network !== 'hysteria') {
    const profileSettings = (profile as ExternalProxyEntry & Record<string, unknown>)[settingsKey];
    const parentSettings = parentStreamRecord[settingsKey];
    if (profileSettings !== undefined) {
      if (!valuesDeepEqual(profileSettings, parentSettings)) return false;
    } else if (parentSettings === undefined) {
      return false;
    }
  }

  const parentSecurity = parentStreamSettings.security || 'none';
  const security = effectiveProfileSecurity(parentStreamSettings, profile);
  if (security !== parentSecurity) return false;

  if (security === 'none' && (parentTlsSettings !== undefined || parentRealitySettings !== undefined)) {
    return false;
  }
  if (security === 'tls' && parentRealitySettings !== undefined) return false;
  if (security === 'reality' && parentTlsSettings !== undefined) return false;

  const runtime = profile.runtime;
  // Backend aliasing compares the parent protocol Settings JSON too. The
  // browser does not receive that JSON here, so any explicit flow override is
  // conservatively treated as a distinct runtime endpoint.
  if (profile.flow !== undefined) return false;
  if (runtime?.sockopt !== undefined && !valuesDeepEqual(
    runtime.sockopt,
    parentStreamSettings.sockopt,
  )) return false;

  if (security === 'tls' && runtime?.tlsSettings !== undefined && !valuesDeepEqual(
    withoutClientSecuritySettings(runtime.tlsSettings),
    withoutClientSecuritySettings(parentTlsSettings),
  )) return false;

  if (security === 'reality' && runtime?.realitySettings !== undefined && !valuesDeepEqual(
    withoutClientSecuritySettings(runtime.realitySettings),
    withoutClientSecuritySettings(parentRealitySettings),
  )) return false;

  const effectiveFinalMask = effectiveSubscriptionProfileFinalMask(
    parentStreamSettings,
    profile,
    network,
  );
  if (!valuesDeepEqual(
    effectiveFinalMask,
    parentStreamSettings.finalmask,
  )) return false;

  return true;
}

function udpServerFingerprint(
  parentStreamSettings: Partial<StreamSettings>,
  endpoint: RuntimeEndpoint,
): Record<string, unknown> | null {
  if (endpoint.network !== 'kcp' && endpoint.network !== 'hysteria') return null;
  const parent = parentStreamSettings as unknown as Record<string, unknown>;
  const runtime = endpoint.profile?.runtime;
  const transport = endpoint.network === 'kcp'
    ? ((parentStreamSettings.network || 'tcp') === 'kcp' ? parent.kcpSettings ?? {} : {})
    : parent.hysteriaSettings ?? {};
  const security = endpoint.security || 'none';
  return {
    network: endpoint.network,
    security,
    transport,
    sockopt: runtime?.sockopt ?? parent.sockopt,
    tlsSettings: security === 'tls'
      ? withoutClientSecuritySettings(runtime?.tlsSettings ?? parent.tlsSettings)
      : undefined,
    realitySettings: security === 'reality'
      ? withoutClientSecuritySettings(runtime?.realitySettings ?? parent.realitySettings)
      : undefined,
    finalmask: endpoint.profile
      ? effectiveSubscriptionProfileFinalMask(
        parentStreamSettings,
        endpoint.profile,
        endpoint.network,
      )
      : parent.finalmask,
    flow: endpoint.profile?.flow,
  };
}

function runtimeBindingsConflict(left: RuntimeEndpoint, right: RuntimeEndpoint): boolean {
  return left.port === right.port
    && left.transport === right.transport
    && runtimeListenOverlaps(left.listen, right.listen);
}

function runtimeBindingKey(binding: RuntimeEndpoint): string {
  return `${binding.transport}|${binding.listen}|${binding.port}`;
}

function validRuntimePort(value: unknown): number | null {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= 1
    && value <= 65535
    ? value
    : null;
}

function includesAnyCharacter(value: string, characters: string): boolean {
  for (const character of characters) {
    if (value.includes(character)) return true;
  }
  return false;
}

function normalizeHTTPHost(value: string): string | null {
  const candidate = value.trim();
  if (
    !candidate
    || candidate.includes('\u0000')
    || /\s/u.test(candidate)
    || includesAnyCharacter(candidate, '/@?#')
  ) return null;

  let host = candidate;
  if (candidate.startsWith('[')) {
    const match = candidate.match(/^\[([^\]]+)](?::(\d+))?$/);
    if (!match || (match[2] && Number(match[2]) > 65535)) return null;
    return canonicalIPLiteral(match[1]);
  }

  const colonCount = [...candidate].filter((character) => character === ':').length;
  if (colonCount > 1) return canonicalIPLiteral(candidate);
  if (colonCount === 1) {
    const separator = candidate.lastIndexOf(':');
    const port = candidate.slice(separator + 1);
    if (!/^\d+$/.test(port) || Number(port) > 65535) return null;
    host = candidate.slice(0, separator);
  }

  host = host.replace(/\.$/, '');
  if (!host) return null;
  const ip = canonicalIPLiteral(host);
  if (ip) return ip;
  try {
    const ascii = new URL(`http://${host}/`).hostname.toLowerCase().replace(/\.$/, '');
    if (!ascii || ascii.includes('*') || ascii.length > 253) return null;
    return ascii;
  } catch {
    return null;
  }
}

function normalizeHTTPPath(value: string): string | null {
  const candidate = value.trim() || '/';
  if (
    !candidate.startsWith('/')
    || candidate.includes('\u0000')
    || includesAnyCharacter(candidate, '\r\n?#')
  ) return null;
  for (let index = 0; index < candidate.length; index += 1) {
    if (candidate[index] !== '%') continue;
    if (!/^[0-9a-fA-F]{2}$/.test(candidate.slice(index + 1, index + 3))) return null;
    index += 2;
  }
  try {
    return encodeURI(candidate);
  } catch {
    return null;
  }
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function normalizeExactSNI(value: string): string | null {
  const candidate = value.trim().replace(/\.$/, '').toLowerCase();
  if (
    !candidate
    || candidate.includes('*')
    || candidate.includes('\u0000')
    || /\s/u.test(candidate)
    || includesAnyCharacter(candidate, '/:@?#%[]')
    || candidate.includes('\\')
  ) return null;
  const ascii = normalizeHTTPHost(candidate);
  if (!ascii || canonicalIPLiteral(ascii)) return null;
  return ascii;
}

function nestedString(record: unknown, path: string[]): string {
  let current: unknown = record;
  for (const key of path) {
    if (!isRecord(current)) return '';
    current = current[key];
  }
  return typeof current === 'string' ? current.trim() : '';
}

function singleStringArray(record: unknown, path: string[]): string {
  let current: unknown = record;
  for (const key of path) {
    if (!isRecord(current)) return '';
    current = current[key];
  }
  return Array.isArray(current) && current.length === 1 && typeof current[0] === 'string'
    ? current[0].trim()
    : '';
}

function endpointUsesECH(endpoint: RuntimeEndpoint): boolean {
  const profile = endpoint.profile;
  if (profile) {
    const raw = profile as ExternalProxyEntry & Record<string, unknown>;
    if (typeof raw.echConfigList === 'string' && raw.echConfigList.trim()) return true;
  }
  return Boolean(nestedString(
    endpoint.stream as unknown as Record<string, unknown>,
    ['tlsSettings', 'settings', 'echConfigList'],
  ));
}

function endpointSNI(endpoint: RuntimeEndpoint): { value?: string; code?: SubscriptionRuntimeIssueCode } {
  const profile = endpoint.profile;
  const stream = endpoint.stream as unknown as Record<string, unknown>;
  let candidate = '';

  if (endpoint.security === 'tls') {
    if (profile?.keepSniBlank) return { code: 'missing_sni' };
    if (profile?.overrideSniFromAddress) candidate = profile.dest?.trim() ?? '';
    if (!candidate) candidate = nestedString(profile?.tlsSettings, ['serverName']);
    if (!candidate) candidate = profile?.sni?.trim() ?? '';
    if (!candidate) candidate = nestedString(stream.tlsSettings, ['serverName']);
  } else {
    candidate = nestedString(profile?.realitySettings, ['settings', 'serverName']);
    if (!candidate) candidate = singleStringArray(profile?.realitySettings, ['serverNames']);
    if (!candidate) candidate = singleStringArray(stream.realitySettings, ['serverNames']);
  }

  if (!candidate) return { code: 'missing_sni' };
  const normalized = normalizeExactSNI(candidate);
  return normalized ? { value: normalized } : { code: 'invalid_sni' };
}

function endpointHTTP1Selector(endpoint: RuntimeEndpoint): {
  selector?: RuntimeRouteSelector;
  code?: SubscriptionRuntimeIssueCode;
  detail?: string;
} {
  const stream = endpoint.stream as unknown as Record<string, unknown>;
  const settingsKey = profileTransportSettingsKey(endpoint.network);
  const settings = settingsKey && isRecord(stream[settingsKey])
    ? stream[settingsKey] as Record<string, unknown>
    : {};
  const path = normalizeHTTPPath(typeof settings.path === 'string' ? settings.path : '/');
  if (!path) {
    return {
      code: 'invalid_http_selector',
      detail: 'Shared Port requires one valid exact HTTP path without a query or fragment.',
    };
  }

  const rawHosts: string[] = [];
  if (typeof settings.host === 'string' && settings.host.trim()) rawHosts.push(settings.host);
  if (isRecord(settings.headers)) {
    for (const [name, value] of Object.entries(settings.headers)) {
      if (name.toLowerCase() !== 'host') continue;
      if (typeof value === 'string') rawHosts.push(value);
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string') rawHosts.push(item);
        }
      }
    }
  }

  const hosts: string[] = [];
  for (const rawHost of rawHosts) {
    const normalized = normalizeHTTPHost(rawHost);
    if (!normalized) {
      return {
        code: 'invalid_http_selector',
        detail: 'Shared Port HTTP Host selectors must be valid exact DNS names or IP literals.',
      };
    }
    hosts.push(normalized);
  }
  return { selector: { kind: 'http1', hosts: uniqueSorted(hosts), paths: [path] } };
}

function endpointSelector(endpoint: RuntimeEndpoint): { selector?: RuntimeRouteSelector; code?: SubscriptionRuntimeIssueCode; detail?: string } {
  if (endpoint.security === 'tls' || endpoint.security === 'reality') {
    if (endpoint.security === 'tls' && endpointUsesECH(endpoint)) {
      return { code: 'ech_unsupported', detail: 'TLS ECH hides the SNI required by Shared Port.' };
    }
    const sni = endpointSNI(endpoint);
    if (!sni.value) {
      return {
        code: sni.code ?? 'missing_sni',
        detail: sni.code === 'invalid_sni'
          ? 'Shared Port requires one valid exact DNS SNI (no wildcard or IP literal).'
          : 'Shared Port requires a non-empty exact SNI/serverName.',
      };
    }
    return { selector: { kind: 'tls-sni', sni: sni.value } };
  }
  if (endpoint.security !== 'none') {
    return { code: 'unsupported_transport', detail: `Security ${endpoint.security} is not supported.` };
  }

  switch (endpoint.network) {
    case 'tcp':
      return { selector: { kind: 'raw-catch-all' } };
    case 'ws':
    case 'httpupgrade':
      return endpointHTTP1Selector(endpoint);
    case 'grpc':
      return { selector: { kind: 'http2-preface' } };
    case 'xhttp':
      return {
        code: 'cleartext_xhttp',
        detail: 'Cleartext XHTTP is ambiguous; use TLS/REALITY with a unique SNI.',
      };
    default:
      return {
        code: 'unsupported_transport',
        detail: `Transport ${endpoint.network} cannot use the TCP Shared Port frontmux.`,
      };
  }
}

function selectorsHTTPOverlap(left: RuntimeRouteSelector, right: RuntimeRouteSelector): boolean {
  if (left.kind !== 'http1' || right.kind !== 'http1') return false;
  const pathOverlap = (left.paths ?? []).some((path) => (right.paths ?? []).includes(path));
  if (!pathOverlap) return false;
  const leftHosts = left.hosts ?? [];
  const rightHosts = right.hosts ?? [];
  return leftHosts.length === 0
    || rightHosts.length === 0
    || leftHosts.some((host) => rightHosts.includes(host));
}

function makeConflict(
  endpoint: RuntimeEndpoint,
  code: SubscriptionRuntimeIssueCode,
  detail: string,
  other?: RuntimeEndpoint,
): SubscriptionRuntimeConflict | null {
  if (endpoint.profileIndex === null) return null;
  return {
    profileIndex: endpoint.profileIndex,
    kind: other?.profileIndex == null ? 'parent' : 'profile',
    otherProfileIndex: other?.profileIndex ?? undefined,
    listen: endpoint.listen,
    port: endpoint.port,
    transport: endpoint.transport,
    code,
    detail,
  };
}

export function formatSubscriptionRuntimeSocket(
  conflict: Pick<SubscriptionRuntimeConflict, 'listen' | 'port' | 'transport'>,
): string {
  const listen = conflict.listen.includes(':') && !conflict.listen.startsWith('[')
    ? `[${conflict.listen}]`
    : conflict.listen;
  return `${conflict.transport}/${listen}:${conflict.port}`;
}

export function planSubscriptionProfileRuntimeTopology({
  parentListen,
  parentPort,
  parentStreamSettings,
  profiles,
}: SubscriptionRuntimeConflictInput): SubscriptionRuntimeTopologyPlan {
  const normalizedParentListen = normalizeRuntimeListenForComparison(parentListen);
  const parentNetwork = parentStreamSettings.network || 'tcp';
  const parentSecurity = parentStreamSettings.security || 'none';
  const parentEndpoint: RuntimeEndpoint = {
    profileIndex: null,
    listen: normalizedParentListen,
    port: parentPort,
    transport: runtimeTransportFamily(parentNetwork),
    network: parentNetwork,
    security: parentSecurity,
    stream: parentStreamSettings,
    profile: profiles[0] ?? null,
  };

  const plans = new Map<number, SubscriptionRuntimeProfilePlan>();
  const endpoints: RuntimeEndpoint[] = [parentEndpoint];
  profiles.forEach((profile, profileIndex) => {
    if (
      profile.enabled === false
      || !isModernSubscriptionProfile(profile)
      || !hasAutomaticRuntimeMarker(profile)
    ) return;

    const profilePort = validRuntimePort(profile.port)
      ?? validRuntimePort(parentPort);
    if (profilePort === null) return;
    const network = effectiveProfileNetwork(parentStreamSettings, profile);
    const security = effectiveProfileSecurity(parentStreamSettings, profile);
    const endpoint: RuntimeEndpoint = {
      profileIndex,
      listen: normalizedParentListen,
      port: profilePort,
      transport: runtimeTransportFamily(network),
      network,
      security,
      stream: effectiveSubscriptionProfileStream(
        parentStreamSettings as StreamSettings,
        profile,
        profile.dest?.trim() ?? '',
      ),
      profile,
    };

    if (
      runtimeBindingsConflict(parentEndpoint, endpoint)
      && runtimeProfileReusesParentListener(parentStreamSettings, profile)
    ) {
      plans.set(profileIndex, {
        profileIndex,
        mode: 'alias',
        listen: endpoint.listen,
        port: endpoint.port,
        transport: endpoint.transport,
      });
      return;
    }
    endpoints.push(endpoint);
  });

  const conflicts: SubscriptionRuntimeConflict[] = [];
  const markInvalid = (conflict: SubscriptionRuntimeConflict | null) => {
    if (!conflict) return;
    const duplicate = conflicts.some((existing) => (
      existing.profileIndex === conflict.profileIndex
      && existing.code === conflict.code
      && existing.otherProfileIndex === conflict.otherProfileIndex
      && existing.listen === conflict.listen
      && existing.port === conflict.port
      && existing.transport === conflict.transport
    ));
    if (!duplicate) conflicts.push(conflict);
    plans.set(conflict.profileIndex, {
      profileIndex: conflict.profileIndex,
      mode: 'invalid',
      listen: conflict.listen,
      port: conflict.port,
      transport: conflict.transport,
      issue: conflict,
    });
  };
  const markPairInvalid = (
    left: RuntimeEndpoint,
    right: RuntimeEndpoint,
    code: SubscriptionRuntimeIssueCode,
    detail: string,
  ) => {
    markInvalid(makeConflict(left, code, detail, right));
    markInvalid(makeConflict(right, code, detail, left));
  };

  for (let left = 0; left < endpoints.length; left += 1) {
    for (let right = left + 1; right < endpoints.length; right += 1) {
      if (!runtimeBindingsConflict(endpoints[left], endpoints[right])) continue;
      if (runtimeBindingKey(endpoints[left]) === runtimeBindingKey(endpoints[right])) continue;
      const target = endpoints[right].profileIndex === null ? endpoints[left] : endpoints[right];
      const other = target === endpoints[right] ? endpoints[left] : endpoints[right];
      markInvalid(makeConflict(
        target,
        'listen_overlap',
        'Wildcard/specific listen addresses overlap. Shared Port requires the exact same listen value.',
        other,
      ));
    }
  }

  const groups = new Map<string, RuntimeEndpoint[]>();
  for (const endpoint of endpoints) {
    const key = runtimeBindingKey(endpoint);
    groups.set(key, [...(groups.get(key) ?? []), endpoint]);
  }

  for (const group of groups.values()) {
    if (group.length === 1) {
      const endpoint = group[0];
      if (endpoint.profileIndex !== null && !plans.has(endpoint.profileIndex)) {
        plans.set(endpoint.profileIndex, {
          profileIndex: endpoint.profileIndex,
          mode: 'direct',
          listen: endpoint.listen,
          port: endpoint.port,
          transport: endpoint.transport,
        });
      }
      continue;
    }

    if (group[0].transport === 'udp') {
      const fingerprints = group.map((endpoint) => udpServerFingerprint(parentStreamSettings, endpoint));
      const compatible = fingerprints[0] !== null
        && fingerprints.every((fingerprint) => valuesDeepEqual(fingerprint, fingerprints[0]));
      if (!compatible) {
        for (const endpoint of group) {
          const other = group.find((candidate) => candidate !== endpoint);
          markInvalid(makeConflict(
            endpoint,
            'udp_duplicate',
            'Same-port UDP profiles require one compatible server security, FinalMask, Sockopt and protocol policy.',
            other,
          ));
        }
        continue;
      }
      for (const endpoint of group) {
        if (endpoint.profileIndex === null) continue;
        plans.set(endpoint.profileIndex, {
          profileIndex: endpoint.profileIndex,
          mode: 'shared',
          listen: endpoint.listen,
          port: endpoint.port,
          transport: endpoint.transport,
        });
      }
      continue;
    }

    const selected: Array<{ endpoint: RuntimeEndpoint; selector: RuntimeRouteSelector }> = [];
    for (const endpoint of group) {
      const result = endpointSelector(endpoint);
      if (!result.selector) {
        const code = result.code ?? 'unsupported_transport';
        const detail = result.detail ?? 'The endpoint has no unambiguous Shared Port selector.';
        if (endpoint.profileIndex === null) {
          // The parent route is mandatory. A parent with no selector makes the
          // entire shared socket invalid, even when each child profile is
          // individually routable. Mirror the backend's atomic group failure.
          for (const profileEndpoint of group) {
            if (profileEndpoint.profileIndex === null) continue;
            markInvalid(makeConflict(profileEndpoint, code, detail, endpoint));
          }
        } else {
          markInvalid(makeConflict(
            endpoint,
            code,
            detail,
            group.find((candidate) => candidate !== endpoint),
          ));
        }
        continue;
      }
      selected.push({ endpoint, selector: result.selector });
    }

    for (let left = 0; left < selected.length; left += 1) {
      for (let right = left + 1; right < selected.length; right += 1) {
        const first = selected[left];
        const second = selected[right];
        let code: SubscriptionRuntimeIssueCode | null = null;
        let detail = '';
        if (
          first.selector.kind === 'tls-sni'
          && second.selector.kind === 'tls-sni'
          && first.selector.sni === second.selector.sni
        ) {
          code = 'duplicate_sni';
          detail = `SNI ${first.selector.sni} is already used by another route.`;
        } else if (
          first.selector.kind === 'raw-catch-all'
          && second.selector.kind === 'raw-catch-all'
        ) {
          code = 'multiple_raw';
          detail = 'Only one cleartext RAW/TCP catch-all is allowed per shared socket.';
        } else if (
          first.selector.kind === 'http2-preface'
          && second.selector.kind === 'http2-preface'
        ) {
          code = 'multiple_http2';
          detail = 'Only one cleartext HTTP/2 (gRPC) route is allowed per shared socket.';
        } else if (selectorsHTTPOverlap(first.selector, second.selector)) {
          code = 'http_selector_overlap';
          detail = 'HTTP Host/Path selectors overlap with another route.';
        }
        if (code) markPairInvalid(first.endpoint, second.endpoint, code, detail);
      }
    }

    for (const endpoint of group) {
      if (endpoint.profileIndex === null || plans.get(endpoint.profileIndex)?.mode === 'invalid') continue;
      plans.set(endpoint.profileIndex, {
        profileIndex: endpoint.profileIndex,
        mode: 'shared',
        listen: endpoint.listen,
        port: endpoint.port,
        transport: endpoint.transport,
      });
    }
  }

  return {
    profiles: [...plans.values()].sort((left, right) => left.profileIndex - right.profileIndex),
    conflicts: conflicts.sort((left, right) => left.profileIndex - right.profileIndex),
  };
}

export function findSubscriptionProfileRuntimeConflicts(
  input: SubscriptionRuntimeConflictInput,
): SubscriptionRuntimeConflict[] {
  return planSubscriptionProfileRuntimeTopology(input).conflicts;
}
