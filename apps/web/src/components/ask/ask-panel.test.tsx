// @vitest-environment happy-dom

import i18next from 'i18next';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AskPhase, AskTurn } from '../../data/use-ask-question';
import '../../i18n';
import { AskPanel } from './ask-panel';

const askMock = vi.hoisted(() => vi.fn());
const requestOpen = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());

let phaseOverride: AskPhase | undefined;
let turnsOverride: AskTurn[] = [];
let configuredOverride = true;

vi.mock('../../data/use-ask-question', () => ({
  useAskQuestion: () => ({
    phase: phaseOverride ?? { kind: 'idle' },
    turns: turnsOverride,
    ask: askMock,
    reset: vi.fn(),
    configured: configuredOverride,
  }),
}));
vi.mock('../../contexts/repo-inspector-context', () => ({
  useRepoInspector: () => ({ requestOpen }),
}));
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function turn(overrides: Partial<AskTurn> = {}): AskTurn {
  return {
    id: 1,
    question: 'Which rust websocket library?',
    summary: '[0] fits your note about push latency.',
    candidates: [
      {
        item: {
          repoId: 'repo-ws',
          repo: {
            githubId: 1,
            fullName: 'rustws/tungstenite',
            name: 'tungstenite',
            owner: 'rustws',
            description: 'Lightweight WebSocket stream',
            language: 'Rust',
            topics: ['websocket'],
            stargazers: 1800,
            forks: 200,
            homepage: null,
            pushedAt: null,
            repoCreatedAt: null,
            archived: false,
            isFork: false,
            syncedAt: '2026-01-01T00:00:00Z',
          },
          starredAt: '2025-01-01T00:00:00Z',
        },
        repoId: 'repo-ws',
        lexicalScore: 9,
        reasons: [{ kind: 'note', snippet: 'push latency', fullText: 'push latency is fine' }],
      },
    ],
    recommendations: [{ index: 0, repoId: 'repo-ws' }],
    ...overrides,
  };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  askMock.mockClear();
  requestOpen.mockClear();
  navigate.mockClear();
  phaseOverride = { kind: 'idle' };
  turnsOverride = [];
  configuredOverride = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

async function renderPanel(open = true) {
  await act(async () => {
    root.render(<AskPanel open={open} onOpenChange={() => {}} />);
  });
}

function text(): string {
  // Dialog 渲染在 body 的 Radix portal 中，不在测试容器内。
  return document.body.textContent ?? '';
}

async function click(element: Element | null) {
  await act(async () => {
    element?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

function buttonByText(match: string): HTMLElement | null {
  return (
    [...document.body.querySelectorAll('button')].find((button) =>
      button.textContent?.includes(match),
    ) ?? null
  );
}

async function setInputValue(input: Element, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  await act(async () => {
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('AskPanel states', () => {
  it('guides to settings when no byok key is configured', async () => {
    configuredOverride = false;
    await renderPanel();

    const label = i18next.t('ask.openSettings', { lng: 'en' });
    expect(text()).toContain(i18next.t('ask.needsSetupTitle', { lng: 'en' }));
    await click(buttonByText(label));
    expect(navigate).toHaveBeenCalledWith('/settings');
  });

  it('shows the empty hint and submits a trimmed question', async () => {
    await renderPanel();

    expect(text()).toContain(i18next.t('ask.emptyHint', { lng: 'en' }));

    const input = document.body.querySelector('input');
    expect(input).not.toBeNull();
    await setInputValue(input as Element, '  websocket rust  ');
    const form = document.body.querySelector('form');
    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(askMock).toHaveBeenCalledWith('websocket rust');
  });

  it('renders an answered turn with validated recommendation cards', async () => {
    turnsOverride = [turn()];
    phaseOverride = { kind: 'answered', turn: turn() };
    await renderPanel();

    expect(text()).toContain('[0] fits your note about push latency.');
    expect(text()).toContain('tungstenite');

    await click(buttonByText('tungstenite'));
    expect(requestOpen).toHaveBeenCalledTimes(1);
    const context = requestOpen.mock.calls[0]?.[1];
    expect(context.sourceKey).toBe('ask');
    expect(context.records).toHaveLength(1);
  });

  it('states an honest no-match without calling the provider', async () => {
    phaseOverride = { kind: 'not_found', question: 'anything' };
    await renderPanel();

    expect(text()).toContain(i18next.t('ask.notFound', { lng: 'en' }));
  });

  it('offers retry for retryable failures but not for an invalid key', async () => {
    phaseOverride = { kind: 'error', question: 'q', reason: 'retryable' };
    await renderPanel();
    expect(text()).toContain(i18next.t('ask.errorRetryable', { lng: 'en' }));
    await click(buttonByText(i18next.t('common.retry', { lng: 'en' })));
    expect(askMock).toHaveBeenCalledWith('q');

    phaseOverride = { kind: 'error', question: 'q', reason: 'invalid_key' };
    await renderPanel();
    expect(text()).toContain(i18next.t('ask.errorInvalidKey', { lng: 'en' }));
    expect(buttonByText(i18next.t('common.retry', { lng: 'en' }))).toBeNull();
  });

  it('surfaces the two-phase progress labels', async () => {
    phaseOverride = { kind: 'recalling', question: 'q' };
    await renderPanel();
    expect(text()).toContain(i18next.t('ask.recalling', { lng: 'en' }));

    phaseOverride = { kind: 'generating', question: 'q' };
    await renderPanel();
    expect(text()).toContain(i18next.t('ask.generating', { lng: 'en' }));
  });
});
