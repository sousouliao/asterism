// @vitest-environment happy-dom

import { ThemeProvider } from '@asterism/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import { SettingsMcpSection } from './settings-mcp-section';

const grantMocks = vi.hoisted(() => ({
  listGrants: vi.fn(),
  revokeGrant: vi.fn(),
}));

vi.mock('@asterism/db', async () => {
  const actual = await vi.importActual<typeof import('@asterism/db')>('@asterism/db');
  return {
    ...actual,
    listOAuthGrants: grantMocks.listGrants,
    revokeOAuthGrant: grantMocks.revokeGrant,
  };
});

vi.mock('../auth/use-session', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

vi.mock('../lib/supabase', () => ({ supabase: {} }));

vi.stubGlobal('matchMedia', (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function renderSection() {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light">
          <SettingsMcpSection endpointUrl="https://demo.supabase.co/functions/v1/mcp" />
        </ThemeProvider>
      </QueryClientProvider>,
    );
  });
  await flush();
}

beforeEach(() => {
  grantMocks.listGrants.mockReset();
  grantMocks.revokeGrant.mockReset();
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
});

describe('SettingsMcpSection', () => {
  it('displays the remote MCP endpoint and empty state when no clients are authorized', async () => {
    grantMocks.listGrants.mockResolvedValue({ data: [], error: null });
    await renderSection();

    expect(container.textContent).toContain('https://demo.supabase.co/functions/v1/mcp');
    expect(container.textContent).toContain('No MCP clients authorized yet.');
  });

  it('lists authorized MCP clients and revokes access after confirmation', async () => {
    grantMocks.listGrants
      .mockResolvedValueOnce({
        data: [
          {
            client: { id: 'client-1', name: 'Claude Code', uri: '', logo_uri: '' },
            scopes: ['openid', 'profile'],
            granted_at: '2026-11-16T00:00:00Z',
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: [], error: null });
    grantMocks.revokeGrant.mockResolvedValue({ data: {}, error: null });

    await renderSection();
    expect(container.textContent).toContain('Claude Code');
    expect(container.textContent).toContain('openid');

    const revokeTrigger = [...container.querySelectorAll('button')].find(
      (btn) => btn.textContent?.trim() === 'Revoke',
    );
    expect(revokeTrigger).toBeDefined();

    await act(async () => {
      revokeTrigger?.click();
    });

    const confirmButton = [...document.body.querySelectorAll('button')].find((btn) =>
      btn.textContent?.includes('Revoke access'),
    );
    expect(confirmButton).toBeDefined();

    await act(async () => {
      confirmButton?.click();
    });
    await flush();

    expect(grantMocks.revokeGrant).toHaveBeenCalledWith({}, 'client-1');
  });
});
