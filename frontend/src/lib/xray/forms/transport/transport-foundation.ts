import type { TcpHeader } from '@/schemas/protocols/stream/tcp';

type TcpHttpCamouflageHeader = Extract<TcpHeader, { type: 'http' }>;

export function createTcpHttpCamouflageHeader(): TcpHttpCamouflageHeader {
  return {
    type: 'http',
    request: {
      version: '1.1',
      method: 'GET',
      path: ['/'],
      headers: {},
    },
    response: {
      version: '1.1',
      status: '200',
      reason: 'OK',
      headers: {},
    },
  };
}

export function createTcpHeaderForCamouflage(enabled: boolean): TcpHeader {
  return enabled ? createTcpHttpCamouflageHeader() : { type: 'none' };
}
