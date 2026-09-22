// @vitest-environment happy-dom

import i18next from 'i18next';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AskPhase, AskTurn } from '../../data/use-ask-question';
import type { AskSessionRecord } from '../../lib/ask-session-storage';
import '../../i18n';
import { AskDockContent } from './ask-panel';

const askMock = vi.hoisted(() => vi.fn());
const continueMock = vi.hoisted(() => vi.fn());
const resetMock = vi.hoisted(() => vi.fn());
const requestOpen = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());
const loadSessionMock = vi.hoisted(() => vi.fn());
const startNewSessionMock = vi.hoisted(() => vi.fn());
const deleteSessionMock = vi.hoisted(() => vi.fn());
const clearAllSessionsMock = vi.hoisted(() => vi.fn());

let phaseOverride: AskPhase | undefined;
let turnsOverride: AskTurn[] = [];
let configuredOverride = true;
let sessionsOverride: AskSessionRecord[] = [];

vi.mock('../../data/use-ask-question', () => ({
  useAskQuestion: () => ({
    phase: phaseOverride ?? { kind: 'idle' },
    turns: turnsOverride,
    ask: askMock,
    continueAsk: continueMock,
    reset: resetMock,
    configured: configuredOverride,
    sessions: sessionsOverride,
    loadSession: loadSessionMock,
    startNewSession: startNewSessionMock,
    deleteSession: deleteSessionMock,
    clearAllSessions: clearAllSessionsMock,
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
    recommendations: [
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
    ...overrides,
  };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  askMock.mockClear();
  continueMock.mockClear();
  resetMock.mockClear();
  requestOpen.mockClear();
  navigate.mockClear();
  loadSessionMock.mockClear();
  startNewSessionMock.mockClear();
  deleteSessionMock.mockClear();
  clearAllSessionsMock.mockClear();
  sessionsOverride = [];
  phaseOverride = { kind: 'idle' };
  turnsOverride = [];
  configuredOverride = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

async function renderPanel() {
  await act(async () => {
    root.render(
      <AskDockContent
        ask={{
          phase: phaseOverride ?? { kind: 'idle' },
          turns: turnsOverride,
          ask: askMock,
          continueAsk: continueMock,
          reset: resetMock,
          configured: configuredOverride,
          sessions: sessionsOverride,
          loadSession: loadSessionMock,
          startNewSession: startNewSessionMock,
          deleteSession: deleteSessionMock,
          clearAllSessions: clearAllSessionsMock,
        }}
      />,
    );
  });
}

function text(): string {
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

describe('AskDock states', () => {
  it('guides to settings when no byok key is configured', async () => {
    configuredOverride = false;
    await renderPanel();

    const label = i18next.t('ask.openSettings', { lng: 'en' });
    expect(text()).toContain(i18next.t('ask.needsSetupTitle', { lng: 'en' }));
    await click(buttonByText(label));
    expect(navigate).toHaveBeenCalledWith('/settings');
  });

  it('renders pill composer without empty hint and submits a trimmed question', async () => {
    await renderPanel();

    expect(text()).not.toContain(i18next.t('ask.emptyHint', { lng: 'en' }));

    const input = document.body.querySelector('input');
    expect(input).not.toBeNull();
    const form = document.body.querySelector('form');
    expect(form?.className).toContain('rounded-full');

    await setInputValue(input as Element, '  websocket rust  ');
    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(askMock).toHaveBeenCalledWith('websocket rust');
  });

  it('renders an answered turn with validated recommendation cards and can be collapsed and expanded', async () => {
    turnsOverride = [turn()];
    phaseOverride = { kind: 'answered', turn: turn() };
    await renderPanel();

    expect(text()).toContain('Which rust websocket library?');
    expect(text()).toContain('[0] fits your note about push latency.');
    expect(text()).toContain('tungstenite');

    await click(buttonByText('tungstenite'));
    expect(requestOpen).toHaveBeenCalledTimes(1);
    const context = requestOpen.mock.calls[0]?.[1];
    expect(context.sourceKey).toBe('ask');
    expect(context.records).toHaveLength(1);

    await act(async () => {
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    });

    expect(text()).not.toContain('Which rust websocket library?');

    const expandButton = document.body.querySelector(
      `button[aria-label="${i18next.t('ask.expandThread', { lng: 'en' })}"]`,
    );
    expect(expandButton).not.toBeNull();
    await click(expandButton);

    expect(text()).toContain('Which rust websocket library?');
  });

  it('collapses thread on Escape when composer input is empty and resets on subsequent Escape', async () => {
    turnsOverride = [turn()];
    phaseOverride = { kind: 'answered', turn: turn() };
    await renderPanel();

    const input = document.body.querySelector('input');
    await act(async () => {
      input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(text()).not.toContain('Which rust websocket library?');

    await act(async () => {
      input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(resetMock).toHaveBeenCalledTimes(1);
  });

  it('queues the in-flight question as the user turn while generating', async () => {
    phaseOverride = { kind: 'generating', question: 'virtual scroll tools?', text: '' };
    await renderPanel();

    expect(text()).toContain('virtual scroll tools?');
    expect(text()).toContain(i18next.t('ask.generating', { lng: 'en' }));
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

  it('surfaces generating and tool-round progress labels', async () => {
    phaseOverride = { kind: 'generating', question: 'q', text: '' };
    await renderPanel();
    expect(text()).toContain(i18next.t('ask.generating', { lng: 'en' }));

    phaseOverride = { kind: 'generating', question: 'q', text: '', toolLabel: 'searching' };
    await renderPanel();
    expect(text()).toContain(i18next.t('ask.searching', { lng: 'en' }));
  });

  it('offers continue after a budget-exhausted turn without calling it not found', async () => {
    phaseOverride = {
      kind: 'budget_exhausted',
      question: 'Which rust websocket library?',
      text: 'Partial findings so far.',
      recommendations: [],
    };
    await renderPanel();

    expect(text()).toContain(i18next.t('ask.budgetExhausted', { lng: 'en' }));
    expect(text()).not.toContain(i18next.t('ask.notFound', { lng: 'en' }));
    await click(buttonByText(i18next.t('ask.continueExploring', { lng: 'en' })));
    expect(continueMock).toHaveBeenCalledTimes(1);
  });

  it('shows streaming markdown and a stop control while generating', async () => {
    const stop = vi.fn();
    const generating: AskPhase = {
      kind: 'generating',
      question: 'q',
      text: 'Your collection already has **tungstenite**.',
    };
    phaseOverride = generating;
    await act(async () => {
      root.render(
        <AskDockContent
          ask={{
            phase: generating,
            turns: [],
            ask: askMock,
            stop,
            reset: resetMock,
            configured: true,
          }}
        />,
      );
    });
    expect(text()).toContain('tungstenite');
    const stopButton = document.body.querySelector(
      `button[aria-label="${i18next.t('ask.stopGenerating', { lng: 'en' })}"]`,
    );
    expect(stopButton).not.toBeNull();
    await click(stopButton);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('lets clicks pass through the dock wrapper around the interactive composer and cabin', async () => {
    await renderPanel();

    const wrapper = document.body.querySelector('[data-ask-dock]');
    const composer = wrapper?.querySelector('form');
    expect(wrapper?.className).toContain('pointer-events-none');
    expect(composer?.className).toContain('pointer-events-auto');

    // 有问答时，上方 cabin 也是 pointer-events-auto
    turnsOverride = [turn()];
    phaseOverride = { kind: 'answered', turn: turn() };
    await renderPanel();
    const cabin = document.body.querySelector('section');
    expect(cabin?.className).toContain('pointer-events-auto');
  });

  it('renders slash menu when typing / and triggers /new command', async () => {
    await renderPanel();
    const input = document.body.querySelector('input');
    expect(input).not.toBeNull();
    if (!input) return;

    await setInputValue(input, '/');

    const menu = document.body.querySelector('[role="menu"]');
    expect(menu).not.toBeNull();
    expect(menu?.textContent).toContain('/history');
    expect(menu?.textContent).toContain('/new');

    const newBtn = Array.from(menu?.querySelectorAll('button') ?? []).find((b) =>
      b.textContent?.includes('/new'),
    );
    expect(newBtn).toBeDefined();

    await click(newBtn ?? null);
    expect(startNewSessionMock).toHaveBeenCalledTimes(1);
  });

  it('renders slash menu, selects /history, transitions to history view, and loads a session', async () => {
    sessionsOverride = [
      {
        id: 's-1',
        title: 'How to build with React 19?',
        createdAt: Date.now() - 5000,
        updatedAt: Date.now() - 5000,
        turns: [turn({ id: 1, question: 'How to build with React 19?' })],
      },
    ];

    await renderPanel();
    const input = document.body.querySelector('input');
    expect(input).not.toBeNull();
    if (!input) return;

    await setInputValue(input, '/');

    const historyBtn = Array.from(
      document.body.querySelectorAll('[role="menu"] button') ?? [],
    ).find((b) => b.textContent?.includes('/history'));
    expect(historyBtn).toBeDefined();

    await click(historyBtn ?? null);

    // Should now be in history view
    expect(input.placeholder).toBe(i18next.t('ask.history.searchPlaceholder', { lng: 'en' }));
    expect(document.body.textContent).toContain('How to build with React 19?');

    const sessionItem = document.body.querySelector('[data-session-index="0"]');
    expect(sessionItem).not.toBeNull();

    const sessionBtn = sessionItem?.querySelector('button') ?? null;
    expect(sessionBtn).not.toBeNull();

    await click(sessionBtn);
    expect(loadSessionMock).toHaveBeenCalledWith(sessionsOverride[0]);
  });

  it('filters sessions in history view and supports Esc to return to chat view', async () => {
    sessionsOverride = [
      {
        id: 's-1',
        title: 'React 19 Server Components',
        createdAt: Date.now() - 5000,
        updatedAt: Date.now() - 5000,
        turns: [turn({ id: 1, question: 'React 19 Server Components' })],
      },
      {
        id: 's-2',
        title: 'Rust WebAssembly toolchain',
        createdAt: Date.now() - 10000,
        updatedAt: Date.now() - 10000,
        turns: [turn({ id: 2, question: 'Rust WebAssembly toolchain' })],
      },
    ];

    await renderPanel();
    const input = document.body.querySelector('input');
    expect(input).not.toBeNull();
    if (!input) return;

    // Open slash menu and enter history
    await setInputValue(input, '/history');
    const form = document.body.querySelector('form');
    expect(form).not.toBeNull();
    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(document.body.textContent).toContain('React 19 Server Components');
    expect(document.body.textContent).toContain('Rust WebAssembly toolchain');

    // Type query to filter
    await setInputValue(input, 'webassembly');
    expect(document.body.textContent).not.toContain('React 19 Server Components');
    expect(document.body.textContent).toContain('Rust WebAssembly toolchain');

    // Esc clears query first
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(input.value).toBe('');

    // Esc again exits history view back to chat view
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(input.placeholder).toBe(i18next.t('ask.placeholder', { lng: 'en' }));
  });
});
