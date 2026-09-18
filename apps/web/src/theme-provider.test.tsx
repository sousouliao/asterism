// @vitest-environment happy-dom

import { THEME_STORAGE_KEY, ThemeProvider, useTheme } from '@asterism/ui';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function stubMatchMedia(prefersDark: boolean) {
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
}

function Probe() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button type="button" onClick={() => setTheme('dark')}>
        dark
      </button>
    </div>
  );
}

async function renderProbe({
  stored,
  prefersDark,
}: {
  stored: string | null;
  prefersDark: boolean;
}) {
  window.localStorage.clear();
  if (stored !== null) {
    window.localStorage.setItem(THEME_STORAGE_KEY, stored);
  }
  stubMatchMedia(prefersDark);

  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
  });

  return { container, root };
}

describe('theme preference', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = '';
  });

  it('applies a stored dark theme to the document on load', async () => {
    const { container, root } = await renderProbe({ stored: 'dark', prefersDark: false });

    expect(container.querySelector('[data-testid="theme"]')?.textContent).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');

    await act(async () => root.unmount());
    container.remove();
  });

  it('writes the chosen theme for the next session', async () => {
    const { container, root } = await renderProbe({ stored: null, prefersDark: false });

    expect(container.querySelector('[data-testid="theme"]')?.textContent).toBe('system');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();

    await act(async () => container.querySelector('button')?.click());

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    await act(async () => root.unmount());
    container.remove();
  });

  it('falls back to the system theme when the stored value is unsupported', async () => {
    const { container, root } = await renderProbe({ stored: 'sepia', prefersDark: true });

    expect(container.querySelector('[data-testid="theme"]')?.textContent).toBe('system');
    expect(container.querySelector('[data-testid="resolved"]')?.textContent).toBe('dark');

    await act(async () => root.unmount());
    container.remove();
  });
});
