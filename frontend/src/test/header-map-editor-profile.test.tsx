import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { HeaderMapEditor } from '@/components/form';

describe('HeaderMapEditor profile variant', () => {
  it('keeps blank rows locally and emits duplicate v2 headers as arrays', () => {
    const onChange = vi.fn();
    const { container, getByLabelText } = render(
      <HeaderMapEditor
        mode="v2"
        variant="profile"
        label="Request Headers"
        onChange={onChange}
      />,
    );

    const add = container.querySelector('.ext-proxy-header-editor__add');
    expect(add).toBeInstanceOf(HTMLButtonElement);

    fireEvent.click(add as HTMLButtonElement);
    expect(onChange).toHaveBeenLastCalledWith({});

    fireEvent.change(getByLabelText('Header name 1'), {
      target: { value: 'X-Test' },
    });
    fireEvent.change(getByLabelText('Header value 1'), {
      target: { value: 'one' },
    });
    expect(onChange).toHaveBeenLastCalledWith({ 'X-Test': ['one'] });

    fireEvent.click(add as HTMLButtonElement);
    fireEvent.change(getByLabelText('Header name 2'), {
      target: { value: 'X-Test' },
    });
    fireEvent.change(getByLabelText('Header value 2'), {
      target: { value: 'two' },
    });

    expect(onChange).toHaveBeenLastCalledWith({
      'X-Test': ['one', 'two'],
    });
  });
});
