// @vitest-environment happy-dom

import { ThemeProvider } from '@asterism/ui';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import { OAuthConsentPage } from './oauth-consent';

const oauthMocks = vi.hoisted(() => ({
  getDetails: vi.fn(),
  approve: vi.fn(),
  deny: vi.fn(),
}));

vi.mock('@asterism/db', async () => {
  const actual = await vi.importActual<typeof import('@asterism/db')>('@asterism/db');
  return {
    ...actual,
    getOAuthAuthorizationDetails: oauthMocks.getDetails,
    approveOAuthAuthorization: oauthMocks.approve,
    denyOAuthAuthorization: oauthMocks.deny,
  };
});

vi.mock('../auth/use-session', () => ({
  useSession: () => ({ session: { user: { id: 'u1', user_metadata: { user_name: 'ada' } } } }),
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

async function renderConsent(initialEntry: string, onRedirect = vi.fn()) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <ThemeProvider defaultTheme="light">
          <OAuthConsentPage onRedirect={onRedirect} />
        </ThemeProvider>
      </MemoryRouter>,
    );
  });
  return { onRedirect };
}

beforeEach(() => {
  oauthMocks.getDetails.mockReset();
  oauthMocks.approve.mockReset();
  oauthMocks.deny.mockReset();
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
});

describe('OAuthConsentPage', () => {
  it('shows an error when authorization_id is missing', async () => {
    await renderConsent('/oauth/consent');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Missing authorization request ID',
    );
    expect(oauthMocks.getDetails).not.toHaveBeenCalled();
  });

  it('redirects immediately when user already consented', async () => {
    const onRedirect = vi.fn();
    oauthMocks.getDetails.mockResolvedValue({
      data: { redirect_url: 'http://127.0.0.1:4321/callback?code=abc' },
      error: null,
    });
    await renderConsent('/oauth/consent?authorization_id=auth-1', onRedirect);
    expect(onRedirect).toHaveBeenCalledWith('http://127.0.0.1:4321/callback?code=abc');
  });

  it('renders client info and approves authorization', async () => {
    const onRedirect = vi.fn();
    oauthMocks.getDetails.mockResolvedValue({
      data: {
        authorization_id: 'auth-2',
        redirect_uri: 'http://127.0.0.1:4321/callback',
        client: { id: 'c1', name: 'Cursor MCP', uri: 'https://cursor.com', logo_uri: '' },
        user: { id: 'u1', email: 'ada@example.test' },
        scope: 'openid profile',
      },
      error: null,
    });
    oauthMocks.approve.mockResolvedValue({
      data: { redirect_url: 'http://127.0.0.1:4321/callback?code=xyz' },
      error: null,
    });

    await renderConsent('/oauth/consent?authorization_id=auth-2', onRedirect);
    expect(container.textContent).toContain('Cursor MCP');
    expect(container.textContent).toContain('http://127.0.0.1:4321');
    expect(container.textContent).toContain('openid');

    const buttons = [...container.querySelectorAll('button')];
    const approveButton = buttons.find((btn) => btn.textContent?.includes('Authorize'));
    expect(approveButton).toBeDefined();

    await act(async () => {
      approveButton?.click();
    });
    expect(oauthMocks.approve).toHaveBeenCalledWith({}, 'auth-2');
    expect(onRedirect).toHaveBeenCalledWith('http://127.0.0.1:4321/callback?code=xyz');
  });
});
