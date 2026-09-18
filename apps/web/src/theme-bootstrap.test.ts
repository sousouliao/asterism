// @vitest-environment happy-dom

import { THEME_STORAGE_KEY } from '@asterism/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import indexHtml from '../index.html?raw';

function readBootstrapScript(): string {
  const match = indexHtml.match(/<script>([\s\S]*?)<\/script>/);
  if (!match?.[1]) {
    throw new Error('index.html must inline a pre-paint theme bootstrap script');
  }
  return match[1];
}

const bootstrapScript = readBootstrapScript();

function runBootstrap(stored: string | null, prefersDark: boolean) {
  window.localStorage.clear();
  if (stored !== null) {
    window.localStorage.setItem(THEME_STORAGE_KEY, stored);
  }
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: prefersDark && query.includes('prefers-color-scheme: dark'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));

  const root = document.documentElement;
  root.classList.remove('dark');
  root.style.colorScheme = '';

  new Function(bootstrapScript)();

  return { dark: root.classList.contains('dark'), colorScheme: root.style.colorScheme };
}

describe('pre-paint theme bootstrap', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('runs in the head before the app module so no frame paints the wrong theme', () => {
    expect(indexHtml).toContain(THEME_STORAGE_KEY);
    expect(indexHtml.indexOf(bootstrapScript)).toBeLessThan(indexHtml.indexOf('type="module"'));
  });

  it('applies a stored dark theme before the first paint', () => {
    expect(runBootstrap('dark', false)).toEqual({ dark: true, colorScheme: 'dark' });
  });

  it('applies a stored light theme before the first paint', () => {
    expect(runBootstrap('light', true)).toEqual({ dark: false, colorScheme: 'light' });
  });

  it('follows the system preference when the choice is system or absent', () => {
    expect(runBootstrap('system', true)).toEqual({ dark: true, colorScheme: 'dark' });
    expect(runBootstrap(null, true)).toEqual({ dark: true, colorScheme: 'dark' });
    expect(runBootstrap(null, false)).toEqual({ dark: false, colorScheme: 'light' });
  });

  it('treats an unknown stored value as the system default', () => {
    expect(runBootstrap('sepia', false)).toEqual({ dark: false, colorScheme: 'light' });
  });
});
