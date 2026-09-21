// @vitest-environment happy-dom

import i18next from 'i18next';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AskPhase, AskTurn } from '../../data/use-ask-question';
import '../../i18n';
import { AskDockContent } from './ask-panel';

const askMock = vi.hoisted(() => vi.fn());
const resetMock = vi.hoisted(() => vi.fn());
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
  resetMock.mockClear();
  requestOpen.mockClear();
  navigate.mockClear();
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
          reset: resetMock,
          configured: configuredOverride,
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

  it('renders an answered turn with validated recommendation cards and can be closed', async () => {
    turnsOverride = [turn()];
    phaseOverride = { kind: 'answered', turn: turn() };
    await renderPanel();

    expect(text()).toContain('Which rust websocket library?');
    expect(text()).toContain('[0] fits your note about push latency.');
    expect(text()).toContain('tungstenite');

    const closeButton = document.body.querySelector('button[aria-label="Close"]');
    expect(closeButton).not.toBeNull();
    await click(closeButton);
    expect(resetMock).toHaveBeenCalledTimes(1);

    await click(buttonByText('tungstenite'));
    expect(requestOpen).toHaveBeenCalledTimes(1);
    const context = requestOpen.mock.calls[0]?.[1];
    expect(context.sourceKey).toBe('ask');
    expect(context.records).toHaveLength(1);
  });

  it('closes thread on Escape when composer input is empty', async () => {
    turnsOverride = [turn()];
    phaseOverride = { kind: 'answered', turn: turn() };
    await renderPanel();

    const input = document.body.querySelector('input');
    await act(async () => {
      input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(resetMock).toHaveBeenCalledTimes(1);
  });

  it('queues the in-flight question as the user turn while recalling', async () => {
    phaseOverride = { kind: 'recalling', question: 'virtual scroll tools?' };
    await renderPanel();

    expect(text()).toContain('virtual scroll tools?');
    expect(text()).toContain(i18next.t('ask.recalling', { lng: 'en' }));
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

    phaseOverride = { kind: 'generating', question: 'q', text: '' };
    await renderPanel();
    expect(text()).toContain(i18next.t('ask.generating', { lng: 'en' }));
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
});
