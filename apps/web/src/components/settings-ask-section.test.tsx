// @vitest-environment happy-dom

import i18next from 'i18next';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import { askByokStorageKey, readAskByok, resetAskByokState } from '../lib/ask-byok';
import { SettingsAskSection } from './settings-ask-section';

vi.mock('../auth/use-session', () => ({
  useSession: () => ({ session: { user: { id: 'ask-settings-user' } } }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const USER = 'ask-settings-user';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  resetAskByokState();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

async function renderSection() {
  await act(async () => {
    root.render(<SettingsAskSection />);
  });
}

function text(): string {
  return document.body.textContent ?? '';
}

function buttonByText(match: string): HTMLButtonElement | null {
  return (
    ([...document.body.querySelectorAll('button')] as HTMLButtonElement[]).find((button) =>
      button.textContent?.includes(match),
    ) ?? null
  );
}

async function click(element: HTMLElement | null) {
  await act(async () => {
    element?.click();
  });
}

async function setFieldValue(id: string, value: string) {
  const input = document.body.querySelector(`#${id}`) as HTMLInputElement | null;
  expect(input).not.toBeNull();
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  await act(async () => {
    setter?.call(input, value);
    input?.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('SettingsAskSection', () => {
  it('starts unconfigured and keeps save disabled until the form is complete', async () => {
    await renderSection();

    expect(text()).toContain(i18next.t('settings.askNotConfigured', { lng: 'en' }));
    const save = buttonByText(i18next.t('common.save', { lng: 'en' }));
    expect(save?.disabled).toBe(true);

    await setFieldValue('ask-model', 'deepseek-chat');
    await setFieldValue('ask-key', 'sk-test-12345678');
    const saveReady = buttonByText(i18next.t('common.save', { lng: 'en' }));
    expect(saveReady?.disabled).toBe(false);
  });

  it('discloses egress on first save and persists consent with the config', async () => {
    await renderSection();
    await setFieldValue('ask-key', 'sk-test-12345678');

    await click(buttonByText(i18next.t('common.save', { lng: 'en' })));
    expect(text()).toContain(
      i18next.t('settings.askConsentTitle', { provider: 'DeepSeek', lng: 'en' }),
    );

    await click(buttonByText(i18next.t('settings.askConsentConfirm', { lng: 'en' })));

    const stored = readAskByok(USER);
    expect(stored).toMatchObject({
      provider: 'deepseek',
      model: 'deepseek-chat',
      providerKey: 'sk-test-12345678',
      consentedProvider: 'deepseek',
    });
    expect(stored?.consentedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(localStorage.getItem(askByokStorageKey(USER))).toContain('deepseek');
    expect(text()).toContain(i18next.t('settings.askConfigured', { lng: 'en' }));
  });

  it('re-discloses when the provider changes but saves model edits silently', async () => {
    await renderSection();
    await setFieldValue('ask-key', 'sk-test-12345678');
    await click(buttonByText(i18next.t('common.save', { lng: 'en' })));
    await click(buttonByText(i18next.t('settings.askConsentConfirm', { lng: 'en' })));
    const firstConsent = readAskByok(USER)?.consentedAt;

    // 同 Provider 改模型：静默保存，不弹披露，同意时间戳保持不变。
    await setFieldValue('ask-model', 'deepseek-reasoner');
    await click(buttonByText(i18next.t('common.save', { lng: 'en' })));
    expect(text()).not.toContain(
      i18next.t('settings.askConsentTitle', { provider: 'DeepSeek', lng: 'en' }),
    );
    expect(readAskByok(USER)).toMatchObject({ model: 'deepseek-reasoner' });
    expect(readAskByok(USER)?.consentedAt).toBe(firstConsent);

    // 换 Provider（Radix Select portal 中的选项）：保存时重新披露。
    await click(document.body.querySelector('#ask-provider'));
    const openaiOption = [...document.body.querySelectorAll('[role="option"]')].find((option) =>
      option.textContent?.includes('OpenAI'),
    );
    await act(async () => {
      openaiOption?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await click(buttonByText(i18next.t('common.save', { lng: 'en' })));
    expect(text()).toContain(
      i18next.t('settings.askConsentTitle', { provider: 'OpenAI', lng: 'en' }),
    );
  });

  it('removes the stored key after confirmation', async () => {
    await renderSection();
    await setFieldValue('ask-key', 'sk-test-12345678');
    await click(buttonByText(i18next.t('common.save', { lng: 'en' })));
    await click(buttonByText(i18next.t('settings.askConsentConfirm', { lng: 'en' })));

    await click(buttonByText(i18next.t('settings.askRemove', { lng: 'en' })));
    expect(text()).toContain(i18next.t('settings.askRemoveTitle', { lng: 'en' }));
    // ConfirmDialog 的确认按钮同样带 askRemove 文案，取弹层中的最后一个匹配。
    const confirmButtons = [...document.body.querySelectorAll('button')].filter((button) =>
      button.textContent?.includes(i18next.t('settings.askRemove', { lng: 'en' })),
    );
    await click(confirmButtons[confirmButtons.length - 1] ?? null);

    expect(readAskByok(USER)).toBeNull();
    expect(localStorage.getItem(askByokStorageKey(USER))).toBeNull();
    expect(text()).toContain(i18next.t('settings.askNotConfigured', { lng: 'en' }));
  });
});
