import { describe, expect, it, vi } from 'vitest';

import { finishClientSave } from '@/pages/clients/clientCreateFlow';

describe('client create completion flow', () => {
  it('closes the form before opening info for the newly created client', async () => {
    const calls: string[] = [];
    const close = vi.fn(() => calls.push('close'));
    const onCreated = vi.fn(async (email: string) => {
      calls.push(`created:${email}`);
    });

    const completed = await finishClientSave({
      success: true,
      isEdit: false,
      email: '  test-client  ',
      close,
      onCreated,
    });

    expect(completed).toBe(true);
    expect(close).toHaveBeenCalledTimes(1);
    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(onCreated).toHaveBeenCalledWith('test-client');
    expect(calls).toEqual(['close', 'created:test-client']);
  });

  it('does not close or open info after a failed save', async () => {
    const close = vi.fn();
    const onCreated = vi.fn();

    const completed = await finishClientSave({
      success: false,
      isEdit: false,
      email: 'test-client',
      close,
      onCreated,
    });

    expect(completed).toBe(false);
    expect(close).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('closes an edit form without invoking the create callback', async () => {
    const close = vi.fn();
    const onCreated = vi.fn();

    await finishClientSave({
      success: true,
      isEdit: true,
      email: 'test-client',
      close,
      onCreated,
    });

    expect(close).toHaveBeenCalledTimes(1);
    expect(onCreated).not.toHaveBeenCalled();
  });
});
