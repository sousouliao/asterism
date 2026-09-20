// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../i18n';
import { SettingsAskSection } from './settings-ask-section';

const byok = vi.hoisted(() => ({ useAskByok: vi.fn() }));

vi.mock('./ai-connections-manager', () => ({
  AiConnectionsManager: ({
    title,
    description,
    badge,
  }: {
    title?: string;
    description?: string;
    badge?: string;
  }) => (
    <div data-testid="ai-connections-manager">
      {title}
      {badge}
      {description}
    </div>
  ),
}));
vi.mock('../auth/use-session', () => ({
  useSession: () => ({ session: { user: { id: 'ask-settings-user' } } }),
}));
vi.mock('../lib/ask-byok', () => byok);

let container: HTMLDivElement;
let root: Root;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(async () => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  vi.clearAllMocks();
});

async function renderSection() {
  await act(async () => {
    await i18n.changeLanguage('en');
    root.render(<SettingsAskSection />);
  });
}

describe('SettingsAskSection', () => {
  it('renders the host section with the restored connection manager', async () => {
    byok.useAskByok.mockReturnValue(null);
    await renderSection();

    expect(container.textContent).toContain('Ask Asterism');
    expect(container.textContent).toContain('Not configured');
    expect(container.textContent).toContain('key is stored only in this browser');
    expect(container.textContent).not.toContain('Generation connections');
    expect(container.querySelector('[data-testid="ai-connections-manager"]')).not.toBeNull();
  });

  it('shows the ready badge once a consented config exists', async () => {
    byok.useAskByok.mockReturnValue({
      provider: 'deepseek',
      model: 'deepseek-chat',
      consentedProvider: 'deepseek',
    });
    await renderSection();

    expect(container.textContent).toContain('Ready');
    expect(container.textContent).not.toContain('Not configured');
  });
});
