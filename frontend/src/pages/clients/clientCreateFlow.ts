interface FinishClientSaveOptions {
  success: boolean;
  isEdit: boolean;
  email: unknown;
  close: () => void;
  onCreated?: (email: string) => Promise<void> | void;
}

export async function finishClientSave({
  success,
  isEdit,
  email,
  close,
  onCreated,
}: FinishClientSaveOptions): Promise<boolean> {
  if (!success) return false;

  close();

  const normalizedEmail = String(email ?? '').trim();
  if (!isEdit && normalizedEmail) {
    await onCreated?.(normalizedEmail);
  }

  return true;
}
