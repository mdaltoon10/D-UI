import { describe, expect, it } from 'vitest';

import openApiDocument from '../../public/openapi.json';

type SecurityRequirement = Record<string, unknown[]>;

interface Operation {
  tags?: string[];
  security?: SecurityRequirement[];
  responses?: Record<string, unknown>;
}

interface OpenApiDocument {
  security?: SecurityRequirement[];
  paths: Record<string, Record<string, Operation>>;
}

const document = openApiDocument as unknown as OpenApiDocument;
const httpMethods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);

function operationsForTag(tag: string): Operation[] {
  return Object.values(document.paths).flatMap((pathItem) =>
    Object.entries(pathItem)
      .filter(([method]) => httpMethods.has(method))
      .map(([, operation]) => operation)
      .filter((operation) => operation.tags?.includes(tag)),
  );
}

function operation(method: string, path: string): Operation {
  const value = document.paths[path]?.[method];
  if (!value) {
    throw new Error(`Missing OpenAPI operation: ${method.toUpperCase()} ${path}`);
  }
  return value;
}

describe('generated OpenAPI authentication policy', () => {
  it('keeps the global bearer-or-cookie policy for normal panel APIs', () => {
    expect(document.security).toEqual([{ bearerAuth: [] }, { cookieAuth: [] }]);
    expect(operation('get', '/panel/api/inbounds/list').security).toBeUndefined();
  });

  it.each(['Admins', 'Admin Roles'])(
    'marks every %s operation as browser-session-only',
    (tag) => {
      const operations = operationsForTag(tag);
      expect(operations.length).toBeGreaterThan(0);

      for (const item of operations) {
        expect(item.security).toEqual([{ cookieAuth: [] }]);
        expect(item.responses).toHaveProperty('401');
        expect(item.responses).toHaveProperty('403');
      }
    },
  );

  it('documents public and cookie-only authentication endpoints explicitly', () => {
    expect(operation('post', '/login').security).toEqual([]);
    expect(operation('post', '/getTwoFactorEnable').security).toEqual([]);

    for (const [method, path] of [
      ['post', '/logout'],
      ['get', '/csrf-token'],
    ]) {
      const item = operation(method, path);
      expect(item.security).toEqual([{ cookieAuth: [] }]);
      expect(item.responses).toHaveProperty('401');
      expect(item.responses).toHaveProperty('403');
    }
  });
});
