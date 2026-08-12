import { message } from 'antd';

type FieldErrorTarget = {
  setError?: unknown;
};

type DynamicErrorHandlerArgs = {
  error: unknown;
  fields?: readonly string[];
  form?: FieldErrorTarget;
  contextKey?: string;
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;

  if (error && typeof error === 'object') {
    const row = error as Record<string, unknown>;
    if (typeof row.message === 'string') return row.message;
    if (typeof row.msg === 'string') return row.msg;
    if (typeof row.error === 'string') return row.error;
  }

  return 'Unexpected error';
}

export default function useDynamicErrorHandler() {
  return ({ error, fields, form }: DynamicErrorHandlerArgs) => {
    const description = errorMessage(error);

    if (typeof form?.setError === 'function' && fields?.length) {
      const lowered = description.toLowerCase();
      const target = fields.find(field => lowered.includes(field.toLowerCase()));
      if (target) {
        const setError = form.setError as (name: string, error: { type: string; message: string }) => void;
        setError(target, { type: 'server', message: description });
      }
    }

    message.error(description);
  };
}
