import { createTlsSettingsWithDefaultCert } from '@/lib/xray/inbound-tls-defaults';
import { RealityStreamSettingsSchema } from '@/schemas/protocols/security/reality';

export function nonEmptyUniqueStrings(values: readonly unknown[] | undefined): string[] {
  if (!Array.isArray(values)) return [];
  const normalized = values
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);
  return Array.from(new Set(normalized));
}

export function resolvePreferredRealityValue(
  values: readonly unknown[] | undefined,
  preferred: unknown,
): string {
  const normalized = nonEmptyUniqueStrings(values);
  const preferredValue = typeof preferred === 'string' ? preferred.trim() : '';
  if (preferredValue && (normalized.length === 0 || normalized.includes(preferredValue))) {
    return preferredValue;
  }
  return normalized[0] ?? '';
}

export function mergeUniqueSecurityValues(
  current: readonly unknown[] | undefined,
  incoming: readonly unknown[] | undefined,
): string[] {
  return nonEmptyUniqueStrings([...(current ?? []), ...(incoming ?? [])]);
}

export function remoteCertificateTarget(
  serverName: unknown,
  address: unknown,
  port: unknown,
): string {
  const server = typeof serverName === 'string' ? serverName.trim() : '';
  const fallbackAddress = typeof address === 'string' ? address.trim() : '';
  const host = server || fallbackAddress;
  if (!host) return '';
  const numericPort = typeof port === 'number' && Number.isInteger(port) && port > 0 && port <= 65535
    ? port
    : undefined;
  if (!numericPort || /:\d+$/.test(host) || /^\[[^\]]+\](?::\d+)?$/.test(host)) {
    return host;
  }
  if (host.includes(':')) return `[${host}]:${numericPort}`;
  return `${host}:${numericPort}`;
}

export function createProfileTlsCertificateDraft(): Record<string, unknown> {
  return {
    useFile: true,
    certificateFile: '',
    keyFile: '',
    certificate: [],
    key: [],
    ocspStapling: 0,
    oneTimeLoading: false,
    usage: 'encipherment',
    buildChain: false,
  };
}

export function createProfileRuntimeTlsDefaults(): Record<string, unknown> {
  return createTlsSettingsWithDefaultCert();
}

export function createProfileRuntimeRealityDefaults(): Record<string, unknown> {
  return RealityStreamSettingsSchema.parse({}) as Record<string, unknown>;
}

const TLS_VERSION_ORDER: Record<string, number> = {
  '1.0': 10,
  '1.1': 11,
  '1.2': 12,
  '1.3': 13,
};

export function isTlsVersionRangeValid(minVersion: unknown, maxVersion: unknown): boolean {
  if (typeof minVersion !== 'string' || typeof maxVersion !== 'string') return false;
  const min = TLS_VERSION_ORDER[minVersion];
  const max = TLS_VERSION_ORDER[maxVersion];
  return typeof min === 'number' && typeof max === 'number' && min <= max;
}

export function pemLinesToText(value: unknown): string {
  return Array.isArray(value)
    ? value.filter((line): line is string => typeof line === 'string').join('\n')
    : typeof value === 'string'
      ? value
      : '';
}

export function pemTextToLines(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  return value.replace(/\r\n/g, '\n').split('\n');
}

export function normalizeRealityShortIds(values: readonly unknown[] | undefined): string[] {
  return nonEmptyUniqueStrings(values).filter((value) => /^[0-9a-fA-F]{0,16}$/.test(value));
}

export function isRealityShortIdValid(value: unknown): boolean {
  return typeof value === 'string' && /^[0-9a-fA-F]{0,16}$/.test(value.trim());
}

export function isClientVersionValid(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true;
  return typeof value === 'string' && /^\d+(?:\.\d+){0,3}$/.test(value.trim());
}

function parseClientVersion(value: unknown): number[] | null {
  if (value === undefined || value === null || value === '') return [];
  if (typeof value !== 'string' || !/^\d+(?:\.\d+){0,3}$/.test(value.trim())) {
    return null;
  }
  return value.trim().split('.').map((part) => Number(part));
}

export function isClientVersionRangeValid(
  minVersion: unknown,
  maxVersion: unknown,
): boolean {
  const min = parseClientVersion(minVersion);
  const max = parseClientVersion(maxVersion);
  if (min === null || max === null) return false;
  if (min.length === 0 || max.length === 0) return true;
  const length = Math.max(min.length, max.length);
  for (let index = 0; index < length; index += 1) {
    const left = min[index] ?? 0;
    const right = max[index] ?? 0;
    if (left < right) return true;
    if (left > right) return false;
  }
  return true;
}
