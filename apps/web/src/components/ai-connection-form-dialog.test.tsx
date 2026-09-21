// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../i18n';
import { AiConnectionFormDialog } from './ai-connection-form-dialog';

const mutateMock = vi.fn();
const resetMock = vi.fn();

vi.mock('../data/use-ai-connections', () => ({
  useTestAndDiscoverProbe: () => ({
    mutate: mutateMock,
    reset: resetMock,
    isPending: false,
    isSuccess: false,
    isError: false,
    data: undefined,
  }),
}));

let root: Root | null = null;
let container: HTMLDivElement;

beforeEach(() => {
  void i18n.changeLanguage('zh-CN');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  container.remove();
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

async function renderDialog(open = true) {
  await act(async () => {
    root?.render(
      <AiConnectionFormDialog
        open={open}
        mode="create"
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        title="添加连接"
        submitLabel="添加连接"
      />,
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('AiConnectionFormDialog', () => {
  it('renders provider and api key fields alongside the test button without name input', async () => {
    await renderDialog();

    // Radix Dialog mounts in document.body
    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();

    // Custom name field should NOT exist
    const nameInput = dialog?.querySelector('input[placeholder*="名称"]');
    expect(nameInput).toBeNull();

    // Provider select and API key input must exist
    const keyInput = dialog?.querySelector<HTMLInputElement>('input[type="password"]');
    expect(keyInput).not.toBeNull();

    // The test button should be present
    const buttons = [...(dialog?.querySelectorAll('button') ?? [])];
    const testBtn = buttons.find((b) => b.textContent?.includes('测试连接'));
    expect(testBtn).toBeDefined();
    // Test button should be disabled when key is empty
    expect(testBtn?.disabled).toBe(true);
  });

  it('enables test button when key is typed and triggers test probe on click', async () => {
    await renderDialog();

    const dialog = document.body.querySelector('[role="dialog"]');
    const keyInput = dialog?.querySelector<HTMLInputElement>('input[type="password"]');
    expect(keyInput).not.toBeNull();

    await act(async () => {
      if (keyInput) {
        const descriptor = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value',
        );
        descriptor?.set?.call(keyInput, 'sk-test-key-12345');
        keyInput.dispatchEvent(new Event('input', { bubbles: true }));
        keyInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    const buttons = [...(dialog?.querySelectorAll('button') ?? [])];
    const testBtn = buttons.find((b) => b.textContent?.includes('测试连接'));
    expect(testBtn?.disabled).toBe(false);

    await act(async () => {
      testBtn?.click();
    });

    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'sk-test-key-12345' }),
      expect.any(Object),
    );
  });
});
