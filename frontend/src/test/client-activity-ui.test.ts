import { describe, expect, it } from 'vitest';

import {
  parseClientActivityList,
  parseClientActivityStatus,
} from '@/pages/clients/clientActivity';

describe('client Activity response parsing', () => {
  it('parses a valid monitoring status', () => {
    expect(parseClientActivityStatus({
      clientId: 12,
      enabled: true,
      generation: 4,
      dataEpoch: 2,
    })).toEqual({
      clientId: 12,
      enabled: true,
      generation: 4,
      dataEpoch: 2,
    });
  });

  it('rejects unsafe or malformed monitoring status', () => {
    expect(parseClientActivityStatus({
      clientId: 0,
      enabled: true,
      generation: 4,
      dataEpoch: 2,
    })).toBeNull();

    expect(parseClientActivityStatus({
      clientId: 12,
      enabled: 'true',
      generation: 4,
      dataEpoch: 2,
    })).toBeNull();
  });

  it('parses Activity rows and excludes malformed items', () => {
    expect(parseClientActivityList({
      enabled: true,
      generation: 3,
      dataEpoch: 2,
      total: 2,
      page: 1,
      pageSize: 50,
      items: [
        {
          destination: 'example.com',
          sourceIp: '203.0.113.10',
          uploadBytes: 1024,
          downloadBytes: 4096,
        },
        {
          destination: '',
          sourceIp: '203.0.113.11',
          uploadBytes: 20,
          downloadBytes: 30,
        },
      ],
    })).toEqual({
      enabled: true,
      generation: 3,
      dataEpoch: 2,
      total: 2,
      page: 1,
      pageSize: 50,
      items: [
        {
          destination: 'example.com',
          sourceIp: '203.0.113.10',
          uploadBytes: 1024,
          downloadBytes: 4096,
        },
      ],
    });
  });

  it('rejects malformed Activity list envelopes', () => {
    expect(parseClientActivityList({
      enabled: true,
      generation: 3,
      dataEpoch: 2,
      total: -1,
      page: 1,
      pageSize: 50,
      items: [],
    })).toBeNull();

    expect(parseClientActivityList(null)).toBeNull();
  });
});
