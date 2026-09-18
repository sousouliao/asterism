// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const STORAGE_KEY = 'asterism-language';

async function loadI18n(stored?: string | null) {
  vi.resetModules();
  window.localStorage.clear();
  if (typeof stored === 'string') {
    window.localStorage.setItem(STORAGE_KEY, stored);
  }
  return import('./index');
}

describe('interface language preference', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = 'en';
  });

  it('starts in English when no preference is stored', async () => {
    const { default: i18n } = await loadI18n();

    expect(i18n.resolvedLanguage).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('restores Simplified Chinese on the next visit', async () => {
    const { default: i18n } = await loadI18n('zh-CN');

    expect(i18n.resolvedLanguage).toBe('zh-CN');
    expect(i18n.t('settings.title')).toBe('设置');
    expect(document.documentElement.lang).toBe('zh-CN');
  });

  it('falls back to English when the stored value is unsupported', async () => {
    const { default: i18n } = await loadI18n('fr');

    expect(i18n.resolvedLanguage).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('persists an explicit choice for the next session', async () => {
    const first = await loadI18n();
    await first.changeInterfaceLanguage('zh-CN');

    expect(first.default.resolvedLanguage).toBe('zh-CN');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('zh-CN');

    const second = await loadI18n(window.localStorage.getItem(STORAGE_KEY));
    expect(second.default.resolvedLanguage).toBe('zh-CN');
  });

  it('ignores a language the app does not ship', async () => {
    const { changeInterfaceLanguage, default: i18n } = await loadI18n();

    await changeInterfaceLanguage('de');

    expect(i18n.resolvedLanguage).toBe('en');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
