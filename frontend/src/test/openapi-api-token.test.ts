import { describe, expect, it } from 'vitest';

import openApiDocument from '../../public/openapi.json';

interface Operation {
  security?: Array<Record<string, unknown[]>>;
  requestBody?: {
    content?: {
      'application/json'?: {
        schema?: {
          properties?: Record<string, {
            type?: string;
            items?: { type?: string };
          }>;
        };
      };
    };
  };
  responses?: Record<string, unknown>;
}

interface OpenApiDocument {
  paths: Record<string, Record<string, Operation>>;
}

const document = openApiDocument as unknown as OpenApiDocument;

function operation(method: string, path: string): Operation {
  const value = document.paths[path]?.[method];
  if (!value) throw new Error(`Missing OpenAPI operation: ${method.toUpperCase()} ${path}`);
  return value;
}

describe('generated delegated API-token documentation', () => {
  it('marks every token-management operation as browser-session-only', () => {
    const operations = [
      operation('get', '/panel/api/setting/apiTokens'),
      operation('get', '/panel/api/setting/apiTokens/subjects'),
      operation('post', '/panel/api/setting/apiTokens/create'),
      operation('post', '/panel/api/setting/apiTokens/delete/{id}'),
      operation('post', '/panel/api/setting/apiTokens/setEnabled/{id}'),
    ];

    for (const item of operations) {
      expect(item.security).toEqual([{ cookieAuth: [] }]);
      expect(item.responses).toHaveProperty('401');
      expect(item.responses).toHaveProperty('403');
    }
  });

  it('emits a valid string-array schema for delegated scopes', () => {
    const scopes = operation('post', '/panel/api/setting/apiTokens/create')
      .requestBody?.content?.['application/json']?.schema?.properties?.scopes;

    expect(scopes?.type).toBe('array');
    expect(scopes?.items).toEqual({ type: 'string' });
  });
});
