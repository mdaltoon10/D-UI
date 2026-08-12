import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import { ThemeProvider } from '@/hooks/useTheme';
import type { AllSetting } from '@/models/setting';
import ApiTokenTab from '@/pages/settings/ApiTokenTab';
import SecurityTab from '@/pages/settings/SecurityTab';
import { HttpUtil } from '@/utils';

const currentAdminState = vi.hoisted(() => ({
  value: {
    admin: {
      id: 1,
      role: { slug: 'owner', is_owner: true },
    },
    isLoading: false,
    error: '',
  },
}));

vi.mock('@/pg-ui/hooks/use-admin', () => ({
  useAdmin: () => currentAdminState.value,
}));

function renderWithTheme(ui: ReactNode) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

function tokenListResponse(obj: unknown) {
  return { success: true, msg: '', obj } as never;
}

describe('delegated API token management UI', () => {
  beforeEach(() => {
    vi.mocked(HttpUtil.get).mockReset();
    vi.mocked(HttpUtil.post).mockReset();
    currentAdminState.value = {
      admin: {
        id: 1,
        role: { slug: 'owner', is_owner: true },
      },
      isLoading: false,
      error: '',
    };
  });

  it('only exposes the API-token tab to the current owner', () => {
    currentAdminState.value = {
      admin: {
        id: 2,
        role: { slug: 'operator', is_owner: false },
      },
      isLoading: false,
      error: '',
    };
    const props = {
      allSetting: {} as AllSetting,
      updateSetting: vi.fn(),
      saveSetting: vi.fn(),
    };
    const view = renderWithTheme(<SecurityTab {...props} />);

    expect(screen.queryByRole('tab', { name: /API Token/i })).toBeNull();
    expect(HttpUtil.get).not.toHaveBeenCalled();

    currentAdminState.value = {
      admin: {
        id: 1,
        role: { slug: 'owner', is_owner: true },
      },
      isLoading: false,
      error: '',
    };
    view.rerender(
      <ThemeProvider>
        <SecurityTab {...props} />
      </ThemeProvider>,
    );

    expect(screen.getByRole('tab', { name: /API Token/i })).toBeTruthy();
  });

  it('shows only service-token controls in the create modal', async () => {
    vi.mocked(HttpUtil.get).mockResolvedValueOnce(tokenListResponse([]));

    renderWithTheme(<ApiTokenTab />);
    await waitFor(() => expect(HttpUtil.get).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: /New token/i }));

    expect(await screen.findByText('Full-trust infrastructure credential')).toBeTruthy();
    expect(screen.queryByText('Credential type')).toBeNull();
    expect(screen.queryByRole('radio', { name: /User token/i })).toBeNull();
    expect(screen.queryByRole('radio', { name: /Service token/i })).toBeNull();
    expect(screen.queryByLabelText('Panel administrator')).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'Custom panel bot' })).toBeNull();
    expect(HttpUtil.get).toHaveBeenCalledTimes(1);
  });

  it('shows delegated metadata and prevents re-enabling an expired token', async () => {
    vi.mocked(HttpUtil.get).mockResolvedValueOnce(tokenListResponse([{
      id: 4,
      name: 'expired-operator-token',
      kind: 'delegated',
      subjectAdminId: 7,
      subjectUsername: 'operator-a',
      subjectRoleName: 'Operator',
      scopes: ['clients:read'],
      expiresAt: 1,
      expired: true,
      enabled: true,
      createdAt: 1_780_000_000,
    }]));

    renderWithTheme(<ApiTokenTab />);

    expect(await screen.findByText('expired-operator-token')).toBeTruthy();
    expect(screen.getByText('operator-a')).toBeTruthy();
    expect(screen.getByText('Operator')).toBeTruthy();
    expect(screen.getByText('Read clients')).toBeTruthy();
    expect(screen.getByText('Expired')).toBeTruthy();
    expect((screen.getByRole('switch', {
      name: 'Enable token expired-operator-token',
    }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('requires an explicit warning acknowledgement before creating a service token', async () => {
    const created = {
      id: 12,
      name: 'trusted-remote-panel',
      token: 'hmd_s_one_time_secret',
      kind: 'service',
      scopes: ['*'],
      expiresAt: 1_900_000_000,
      expired: false,
      enabled: true,
      createdAt: 1_800_000_000,
    };
    vi.mocked(HttpUtil.get)
      .mockResolvedValueOnce(tokenListResponse([]))
      .mockResolvedValueOnce(tokenListResponse([{ ...created, token: undefined }]));
    vi.mocked(HttpUtil.post).mockResolvedValueOnce(tokenListResponse(created));

    renderWithTheme(<ApiTokenTab />);
    await waitFor(() => expect(HttpUtil.get).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: /New token/i }));
    expect(HttpUtil.get).toHaveBeenCalledTimes(1);

    expect(await screen.findByText('Full-trust infrastructure credential')).toBeTruthy();
    expect(screen.queryByRole('radio', { name: /User token/i })).toBeNull();
    expect(screen.queryByRole('radio', { name: /Service token/i })).toBeNull();
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'trusted-remote-panel' },
    });
    expect(screen.queryByLabelText('Panel administrator')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Create token' }));
    expect(await screen.findByText('Confirm the service-token security warning.')).toBeTruthy();
    expect(HttpUtil.post).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('checkbox', {
      name: /I understand that this credential has service-level access/i,
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Create token' }));

    await waitFor(() => expect(HttpUtil.post).toHaveBeenCalledTimes(1));
    expect(vi.mocked(HttpUtil.post).mock.calls[0][1]).toEqual({
      name: 'trusted-remote-panel',
      kind: 'service',
      expiresAt: expect.any(Number),
    });
    expect(await screen.findByText('hmd_s_one_time_secret')).toBeTruthy();
  });
});
