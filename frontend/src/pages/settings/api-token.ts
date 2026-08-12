export const API_TOKEN_KINDS = ['delegated', 'service'] as const;
export type ApiTokenKind = (typeof API_TOKEN_KINDS)[number];

export const API_TOKEN_SCOPES = ['clients:read', 'clients:create', 'custom-panel:manage'] as const;
export type ApiTokenScope = (typeof API_TOKEN_SCOPES)[number];

export const API_TOKEN_EXPIRY_DAYS = [30, 90, 180, 365, 0] as const;
export type ApiTokenExpiryDays = (typeof API_TOKEN_EXPIRY_DAYS)[number];

export const DEFAULT_API_TOKEN_EXPIRY_DAYS: ApiTokenExpiryDays = 90;
export const UNIX_MILLISECONDS_THRESHOLD = 100_000_000_000;

export interface ApiTokenRow {
  id: number;
  name: string;
  kind: ApiTokenKind;
  subjectAdminId?: number;
  subjectUsername: string;
  subjectRoleName: string;
  createdByAdminId?: number;
  scopes: string[];
  expiresAt: number;
  expired: boolean;
  enabled: boolean;
  createdAt: number;
}

export interface ApiTokenSubject {
  id: number;
  username: string;
  roleId: number;
  roleName: string;
}

export interface ApiTokenCreateFormValues {
  name: string;
  kind: ApiTokenKind;
  subjectAdminId?: number;
  scopes?: ApiTokenScope[];
  expiryDays: ApiTokenExpiryDays;
  serviceAcknowledged?: boolean;
}

export interface ApiTokenCreatePayload {
  name: string;
  kind: ApiTokenKind;
  expiresAt: number;
  subjectAdminId?: number;
  scopes?: ApiTokenScope[];
}

export interface CreatedApiToken extends ApiTokenRow {
  token: string;
}

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as UnknownRecord;
}

function finiteInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && Number.isInteger(parsed) ? parsed : null;
}

function optionalPositiveInteger(value: unknown): number | undefined {
  const parsed = finiteInteger(value);
  return parsed != null && parsed > 0 ? parsed : undefined;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeKind(value: unknown): ApiTokenKind | null {
  // Rows created before token delegation did not have a kind column and are
  // trusted service credentials. Any other unknown value is corrupt data and
  // must not be mislabeled as a full-access service token in the UI.
  if (value == null || value === '') return 'service';
  return API_TOKEN_KINDS.includes(value as ApiTokenKind) ? value as ApiTokenKind : null;
}

function normalizeScopes(value: unknown, kind: ApiTokenKind): string[] {
  if (!Array.isArray(value)) return kind === 'service' ? ['*'] : [];
  const unique = new Set(
    value.filter((scope): scope is string => typeof scope === 'string' && scope.length > 0),
  );
  return [...unique];
}

export function apiTokenTimestampMilliseconds(timestamp: number): number {
  return timestamp < UNIX_MILLISECONDS_THRESHOLD ? timestamp * 1000 : timestamp;
}

export function parseApiTokenRows(value: unknown, nowUnix = Math.floor(Date.now() / 1000)): ApiTokenRow[] | null {
  if (!Array.isArray(value)) return null;

  const rows: ApiTokenRow[] = [];
  for (const item of value) {
    const raw = asRecord(item);
    if (!raw) return null;
    const id = finiteInteger(raw.id);
    const createdAt = finiteInteger(raw.createdAt);
    const expiresAt = raw.expiresAt == null ? 0 : finiteInteger(raw.expiresAt);
    const name = stringValue(raw.name).trim();
    const kind = normalizeKind(raw.kind);
    const enabled = typeof raw.enabled === 'boolean' ? raw.enabled : null;
    const explicitlyExpired = raw.expired == null
      ? false
      : (typeof raw.expired === 'boolean' ? raw.expired : null);
    if (
      id == null || id <= 0 || createdAt == null || createdAt < 0 ||
      expiresAt == null || expiresAt < 0 || !name || !kind || enabled == null ||
      explicitlyExpired == null
    ) {
      return null;
    }

    rows.push({
      id,
      name,
      kind,
      subjectAdminId: optionalPositiveInteger(raw.subjectAdminId),
      subjectUsername: stringValue(raw.subjectUsername),
      subjectRoleName: stringValue(raw.subjectRoleName),
      createdByAdminId: optionalPositiveInteger(raw.createdByAdminId),
      scopes: normalizeScopes(raw.scopes, kind),
      expiresAt,
      expired: explicitlyExpired || (expiresAt > 0 && expiresAt <= nowUnix),
      enabled,
      createdAt,
    });
  }
  return rows;
}

export function parseApiTokenSubjects(value: unknown): ApiTokenSubject[] | null {
  if (!Array.isArray(value)) return null;

  const subjects: ApiTokenSubject[] = [];
  for (const item of value) {
    const raw = asRecord(item);
    if (!raw) return null;
    const id = finiteInteger(raw.id);
    const roleId = finiteInteger(raw.roleId);
    const username = stringValue(raw.username).trim();
    const roleName = stringValue(raw.roleName).trim();
    if (id == null || id <= 0 || roleId == null || roleId <= 0 || !username || !roleName) {
      return null;
    }
    subjects.push({ id, username, roleId, roleName });
  }
  return subjects;
}

export function parseCreatedApiToken(value: unknown, nowUnix = Math.floor(Date.now() / 1000)): CreatedApiToken | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const token = stringValue(raw.token);
  const rows = parseApiTokenRows([raw], nowUnix);
  if (!token || !rows || rows.length !== 1) return null;
  return { ...rows[0], token };
}

export function buildApiTokenCreatePayload(
  values: ApiTokenCreateFormValues,
  nowUnix = Math.floor(Date.now() / 1000),
): ApiTokenCreatePayload {
  const name = values.name.trim();
  if (!name) throw new Error('name-required');
  if ([...name].length > 64) throw new Error('name-too-long');
  if (!API_TOKEN_KINDS.includes(values.kind)) throw new Error('kind-invalid');
  if (!API_TOKEN_EXPIRY_DAYS.includes(values.expiryDays)) throw new Error('expiry-invalid');

  const expiresAt = values.expiryDays > 0
    ? nowUnix + (values.expiryDays * 24 * 60 * 60)
    : 0;

  if (values.kind === 'service') {
    if (!values.serviceAcknowledged) throw new Error('service-ack-required');
    return { name, kind: 'service', expiresAt };
  }

  const subjectAdminId = finiteInteger(values.subjectAdminId);
  if (subjectAdminId == null || subjectAdminId <= 0) throw new Error('subject-required');

  const requestedScopes = new Set(values.scopes ?? []);
  const scopes = API_TOKEN_SCOPES.filter((scope) => requestedScopes.has(scope));
  if (scopes.length === 0) throw new Error('scope-required');
  if (requestedScopes.size !== scopes.length) throw new Error('scope-invalid');

  return {
    name,
    kind: 'delegated',
    subjectAdminId,
    scopes,
    expiresAt,
  };
}
