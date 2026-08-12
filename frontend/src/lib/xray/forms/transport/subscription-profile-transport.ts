import { GrpcStreamSettingsSchema } from '@/schemas/protocols/stream/grpc';
import { HttpUpgradeStreamSettingsSchema } from '@/schemas/protocols/stream/httpupgrade';
import { KcpStreamSettingsSchema } from '@/schemas/protocols/stream/kcp';
import { TcpStreamSettingsSchema } from '@/schemas/protocols/stream/tcp';
import { WsStreamSettingsSchema } from '@/schemas/protocols/stream/ws';
import { XHttpStreamSettingsSchema } from '@/schemas/protocols/stream/xhttp';

export const PROFILE_TRANSPORT_SETTING_KEYS = [
  'tcpSettings',
  'kcpSettings',
  'wsSettings',
  'grpcSettings',
  'httpupgradeSettings',
  'xhttpSettings',
] as const;

export type ProfileTransportSettingsKey =
  (typeof PROFILE_TRANSPORT_SETTING_KEYS)[number];

export function profileTransportSettingsKey(
  network: string,
): ProfileTransportSettingsKey | null {
  switch (network) {
    case 'tcp':
      return 'tcpSettings';
    case 'kcp':
      return 'kcpSettings';
    case 'ws':
      return 'wsSettings';
    case 'grpc':
      return 'grpcSettings';
    case 'httpupgrade':
      return 'httpupgradeSettings';
    case 'xhttp':
      return 'xhttpSettings';
    default:
      return null;
  }
}

export function createProfileTransportDefaults(
  network: string,
): Record<string, unknown> {
  switch (network) {
    case 'tcp':
      return TcpStreamSettingsSchema.parse({
        acceptProxyProtocol: false,
        header: { type: 'none' },
      });
    case 'kcp':
      return KcpStreamSettingsSchema.parse({});
    case 'ws':
      return WsStreamSettingsSchema.parse({});
    case 'grpc':
      return GrpcStreamSettingsSchema.parse({});
    case 'httpupgrade':
      return HttpUpgradeStreamSettingsSchema.parse({});
    case 'xhttp':
      return XHttpStreamSettingsSchema.parse({});
    default:
      return {};
  }
}
