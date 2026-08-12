import { describe, expect, it } from 'vitest';

import {
  apiTokenTimestampMilliseconds,
  buildApiTokenCreatePayload,
  parseApiTokenRows,
  parseApiTokenSubjects,
  parseCreatedApiToken,
} from '@/pages/settings/api-token';

describe('delegated API token model', () => {
  it('builds an explicitly scoped delegated payload with a Unix-seconds expiry', () => {
    const now = 1_800_000_000;
    const payload = buildApiTokenCreatePayload({
      name: '  telegram-operator-a  ',
      kind: 'delegated',
      subjectAdminId: 7,
      scopes: ['clients:create', 'clients:read', 'clients:create'],
      expiryDays: 90,
    }, now);

    expect(payload).toEqual({
      name: 'telegram-operator-a',
      kind: 'delegated',
      subjectAdminId: 7,
      scopes: ['clients:read', 'clients:create'],
      expiresAt: now + (90 * 24 * 60 * 60),
    });
  });

  it('accepts the dedicated custom-panel compatibility scope', () => {
    const payload = buildApiTokenCreatePayload({
      name: 'ravinods-bot',
      kind: 'delegated',
      subjectAdminId: 7,
      scopes: ['custom-panel:manage'],
      expiryDays: 90,
    }, 1_800_000_000);

    expect(payload.scopes).toEqual(['custom-panel:manage']);
  });

  it('requires deliberate service-token acknowledgement and strips stale delegated fields', () => {
    expect(() => buildApiTokenCreatePayload({
      name: 'remote-panel-a',
      kind: 'service',
      subjectAdminId: 7,
      scopes: ['clients:create'],
      expiryDays: 0,
      serviceAcknowledged: false,
    })).toThrowError('service-ack-required');

    expect(buildApiTokenCreatePayload({
      name: 'remote-panel-a',
      kind: 'service',
      subjectAdminId: 7,
      scopes: ['clients:create'],
      expiryDays: 0,
      serviceAcknowledged: true,
    }, 1_800_000_000)).toEqual({
      name: 'remote-panel-a',
      kind: 'service',
      expiresAt: 0,
    });
  });

  it('rejects missing subjects, empty scopes and unsupported expiry values', () => {
    expect(() => buildApiTokenCreatePayload({
      name: 'missing-subject',
      kind: 'delegated',
      scopes: ['clients:read'],
      expiryDays: 90,
    })).toThrowError('subject-required');

    expect(() => buildApiTokenCreatePayload({
      name: 'missing-scope',
      kind: 'delegated',
      subjectAdminId: 3,
      scopes: [],
      expiryDays: 90,
    })).toThrowError('scope-required');

    expect(() => buildApiTokenCreatePayload({
      name: 'invalid-expiry',
      kind: 'delegated',
      subjectAdminId: 3,
      scopes: ['clients:read'],
      expiryDays: 7 as never,
    })).toThrowError('expiry-invalid');
  });

  it('normalizes legacy service rows and independently detects expiration', () => {
    const rows = parseApiTokenRows([{
      id: 1,
      name: 'legacy-service',
      enabled: true,
      createdAt: 1_782_000_000,
      expiresAt: 1_800_000_000,
      expired: false,
    }], 1_800_000_001);

    expect(rows).toEqual([expect.objectContaining({
      id: 1,
      kind: 'service',
      scopes: ['*'],
      expired: true,
    })]);
    expect(apiTokenTimestampMilliseconds(1_782_000_000)).toBe(1_782_000_000_000);
    expect(apiTokenTimestampMilliseconds(1_782_000_000_123)).toBe(1_782_000_000_123);
  });

  it('rejects malformed list/subject/one-time-token responses instead of rendering partial data', () => {
    expect(parseApiTokenRows({})).toBeNull();
    expect(parseApiTokenRows([{ id: 0, name: '', createdAt: -1 }])).toBeNull();
    expect(parseApiTokenRows([{
      id: 1,
      name: 'corrupt-kind',
      kind: 'unexpected-full-access-kind',
      enabled: true,
      createdAt: 1_800_000_000,
    }])).toBeNull();
    expect(parseApiTokenRows([{
      id: 1,
      name: 'corrupt-enabled',
      enabled: 'false',
      createdAt: 1_800_000_000,
    }])).toBeNull();
    expect(parseApiTokenSubjects([{ id: 3, username: '', roleId: 2, roleName: 'Operator' }])).toBeNull();
    expect(parseCreatedApiToken({
      id: 4,
      name: 'missing-plaintext',
      kind: 'delegated',
      enabled: true,
      createdAt: 1_800_000_000,
    })).toBeNull();
  });
});
