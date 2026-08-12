import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import { HttpUtil } from '@/utils';
import ClientInfoModal from '@/pages/clients/ClientInfoModal';
import ClientQrModal from '@/pages/clients/ClientQrModal';
import type { ClientRecord } from '@/hooks/useClients';
import { renderWithProviders } from './test-utils';

vi.mock('@/hooks/useDatepicker', () => ({
  useDatepicker: () => ({ datepicker: 'gregorian' }),
}));

vi.mock('@/pages/clients/ClientActivityControl', () => ({
  default: () => null,
}));

vi.mock('@/pages/inbounds/qr', () => ({
  QrPanel: ({ value, showQr = true }: { value: string; showQr?: boolean }) => (
    <div data-testid="qr-panel" data-show-qr={String(showQr)}>{value}</div>
  ),
}));

const client: ClientRecord = {
  email: 'test-client',
  subId: 'sub-123',
  enable: true,
  inboundIds: [],
};

const subSettings = {
  enable: true,
  subURI: 'https://panel.example:2096/sub/',
  subJsonURI: '',
  subJsonEnable: false,
  subClashURI: '',
  subClashEnable: false,
  publicHost: 'panel.example',
};

const postQuantumLink = `vless://00000000-0000-0000-0000-000000000000@example.com:443?security=reality&type=tcp&pqv=${'x'.repeat(2603)}#test-client`;

beforeEach(() => {
  vi.mocked(HttpUtil.get).mockReset();
  vi.mocked(HttpUtil.post).mockResolvedValue({ success: true, obj: {} } as never);
});

describe('client configuration modals', () => {
  it('shows the standard subscription and explains PQ direct-QR suppression', async () => {
    vi.mocked(HttpUtil.get).mockResolvedValue({
      success: true,
      msg: '',
      obj: [postQuantumLink],
    } as never);

    renderWithProviders(
      <ClientInfoModal
        open
        client={client}
        inboundsById={{}}
        isOnline={false}
        subSettings={subSettings}
        onOpenChange={() => {}}
      />,
    );

    expect(await screen.findByText('https://panel.example:2096/sub/sub-123')).toBeTruthy();
    expect(await screen.findByText('Direct QR is unavailable for post-quantum configs')).toBeTruthy();

    const disabledQr = await screen.findByRole('button', {
      name: 'Direct QR is unavailable for post-quantum configs',
    });
    expect(disabledQr).toHaveProperty('disabled', true);
  });

  it('surfaces the backend error instead of silently showing no links', async () => {
    vi.mocked(HttpUtil.get).mockResolvedValue({
      success: false,
      msg: 'sub link provider failed',
      obj: null,
    } as never);

    renderWithProviders(
      <ClientInfoModal
        open
        client={client}
        inboundsById={{}}
        isOnline={false}
        subSettings={subSettings}
        onOpenChange={() => {}}
      />,
    );

    expect(await screen.findByText('Configuration loading failed')).toBeTruthy();
    expect(await screen.findByText('sub link provider failed')).toBeTruthy();
  });

  it('shows a real empty state for a successful empty link response', async () => {
    vi.mocked(HttpUtil.get).mockResolvedValue({
      success: true,
      msg: '',
      obj: [],
    } as never);

    renderWithProviders(
      <ClientInfoModal
        open
        client={client}
        inboundsById={{}}
        isOnline={false}
        subSettings={subSettings}
        onOpenChange={() => {}}
      />,
    );

    expect(await screen.findByText('No client configurations were generated.')).toBeTruthy();
    expect(screen.getByText('Check that the client is attached to at least one enabled and supported inbound.')).toBeTruthy();
  });

  it('keeps config copy available while suppressing a PQ QR in the QR modal', async () => {
    vi.mocked(HttpUtil.get).mockResolvedValue({
      success: true,
      msg: '',
      obj: [postQuantumLink],
    } as never);

    renderWithProviders(
      <ClientQrModal
        open
        client={client}
        inboundsById={{}}
        subSettings={{ ...subSettings, enable: false, subURI: '' }}
        onOpenChange={() => {}}
      />,
    );

    await waitFor(() => {
      const panels = screen.getAllByTestId('qr-panel');
      expect(panels.some((panel) => panel.getAttribute('data-show-qr') === 'false')).toBe(true);
    });
    expect(await screen.findByText('Direct QR is unavailable for post-quantum configs')).toBeTruthy();
  });
});
