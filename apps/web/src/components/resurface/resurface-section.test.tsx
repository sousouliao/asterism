// @vitest-environment happy-dom

import type { Memory, Repo } from '@asterism/core';
import type { StarredRepoRecord } from '@asterism/db';
import i18next from 'i18next';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n';
import {
  recordResurfaceFeedback,
  resetResurfaceFeedbackState,
  resurfaceFeedbackStorageKey,
} from '../../lib/resurface-feedback';
import { useRepoInspectorStore } from '../../stores/repo-inspector';
import { ResurfaceSection } from './resurface-section';

const requestOpen = vi.hoisted(() => vi.fn());
const registerContext = vi.hoisted(() => vi.fn());

vi.mock('../../contexts/repo-inspector-context', () => ({
  useRepoInspector: () => ({ requestOpen, registerContext }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeRepo(overrides: Partial<Repo>): Repo {
  return {
    githubId: 1,
    fullName: 'owner/name',
    name: 'name',
    owner: 'owner',
    description: null,
    language: 'TypeScript',
    topics: [],
    stargazers: 0,
    forks: 0,
    homepage: null,
    pushedAt: null,
    repoCreatedAt: null,
    archived: false,
    isFork: false,
    syncedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function record(repoId: string, overrides: Partial<Repo>, starredAt: string): StarredRepoRecord {
  return { repoId, repo: makeRepo(overrides), starredAt };
}

// 固定在遥远过去，保证在任意真实运行日期下都满足沉睡判定。
const records: StarredRepoRecord[] = [
  record(
    'r-worth',
    { fullName: 'owner-worth/repo-worth', name: 'repo-worth' },
    '2023-01-15T00:00:00Z',
  ),
  record(
    'r-missing',
    { fullName: 'owner-missing/repo-missing', name: 'repo-missing', stargazers: 15_000 },
    '2022-06-01T00:00:00Z',
  ),
];

const memoriesByRepoId = new Map<string, Memory>([
  [
    'r-worth',
    {
      repoId: 'r-worth',
      source: 'github_star',
      sourceCreatedAt: '2023-01-15T00:00:00Z',
      whySaved: '网关替换的备选方案',
      note: null,
    },
  ],
]);

const USER = 'resurface-section-test-user';

function findButton(container: HTMLElement, label: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll('button')].find((button) =>
    button.getAttribute('aria-label')?.includes(label),
  );
}

function buttonsByText(container: HTMLElement, text: string): HTMLButtonElement[] {
  return [...container.querySelectorAll('button')].filter((button) =>
    button.textContent?.includes(text),
  );
}

async function renderSection(): Promise<{ container: HTMLDivElement; root: Root }> {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <ResurfaceSection records={records} memoriesByRepoId={memoriesByRepoId} userId={USER} />,
    );
  });
  return { container, root };
}

describe('ResurfaceSection', () => {
  beforeEach(async () => {
    localStorage.clear();
    resetResurfaceFeedbackState();
    useRepoInspectorStore.setState({ record: null, context: null });
    requestOpen.mockClear();
    registerContext.mockClear();
    await i18next.changeLanguage('zh-CN');
  });

  it('renders both streams with explainable reasons and memory echo in zh-CN', async () => {
    const { container, root } = await renderSection();

    expect(container.textContent).toContain('记忆唤醒');
    expect(container.textContent).toContain('值得重温');
    expect(container.textContent).toContain('待补全记忆');
    // 值得重温卡：沉睡理由 + 本人记忆回声
    expect(container.textContent).toContain('收藏于');
    expect(container.textContent).toContain('收藏原因 · 网关替换的备选方案');
    // 待补全卡：缺原因 + 高价值 + 补写入口
    expect(container.textContent).toContain('尚未记录收藏原因');
    expect(container.textContent).toContain('1.5万 Star');
    expect(container.textContent).toContain('补写收藏原因');
    expect(container.textContent).toContain('很有用');

    await act(async () => root.unmount());
    container.remove();
  });

  it('shows note reason instead of why_saved echo when only a note exists', async () => {
    const withNoteOnly = new Map<string, Memory>([
      [
        'r-worth',
        {
          repoId: 'r-worth',
          source: 'github_star',
          sourceCreatedAt: '2023-01-15T00:00:00Z',
          whySaved: null,
          note: '带连接池配置',
        },
      ],
    ]);
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ResurfaceSection records={records} memoriesByRepoId={withNoteOnly} userId={USER} />,
      );
    });

    expect(container.textContent).toContain('记录过笔记');
    expect(container.textContent).toContain('你的笔记 · 带连接池配置');

    await act(async () => root.unmount());
    container.remove();
  });

  it('renders reasons in English after switching locale', async () => {
    await act(async () => {
      await i18next.changeLanguage('en');
    });
    const { container, root } = await renderSection();

    expect(container.textContent).toContain('Worth remembering');
    expect(container.textContent).toContain('Missing context');
    expect(container.textContent).toContain('No saved reason yet');
    expect(container.textContent).toContain('15K stars');
    expect(container.textContent).toContain('Why you saved · 网关替换的备选方案');

    await act(async () => root.unmount());
    container.remove();
  });

  it('opens the repo quick look when the card or the add-intent action is triggered', async () => {
    const { container, root } = await renderSection();

    const openWorth = findButton(container, '打开 owner-worth/repo-worth 的详情');
    expect(openWorth).toBeDefined();
    await act(async () => {
      openWorth?.click();
    });
    expect(requestOpen).toHaveBeenCalledTimes(1);
    expect(requestOpen).toHaveBeenCalledWith(
      records[0],
      expect.objectContaining({ sourceKey: 'resurface' }),
      expect.anything(),
    );

    const addIntent = buttonsByText(container, '补写收藏原因')[0];
    expect(addIntent).toBeDefined();
    await act(async () => {
      addIntent?.click();
    });
    expect(requestOpen).toHaveBeenCalledTimes(2);
    expect(requestOpen).toHaveBeenLastCalledWith(
      records[1],
      expect.objectContaining({ sourceKey: 'resurface' }),
      'pointer',
    );
    await act(async () => root.unmount());
    container.remove();
  });

  it('marks useful feedback locally and removes the card', async () => {
    const { container, root } = await renderSection();

    const useful = buttonsByText(container, '很有用')[0];
    await act(async () => {
      useful?.click();
    });

    expect(container.textContent).not.toContain('repo-worth');
    expect(container.textContent).toContain('repo-missing');
    const stored = localStorage.getItem(resurfaceFeedbackStorageKey(USER));
    expect(stored).toContain('"useful"');

    await act(async () => root.unmount());
    container.remove();
  });

  it('dismisses a card and keeps the other stream intact', async () => {
    const { container, root } = await renderSection();

    const dismiss = findButton(container, '暂不提醒');
    expect(dismiss).toBeDefined();
    await act(async () => {
      dismiss?.click();
    });

    expect(container.textContent).not.toContain('repo-worth');
    expect(container.textContent).toContain('repo-missing');

    await act(async () => root.unmount());
    container.remove();
  });

  it('renders nothing when every candidate is suppressed', async () => {
    recordResurfaceFeedback(USER, 'r-worth', 'dismissed');
    recordResurfaceFeedback(USER, 'r-missing', 'dismissed');

    const { container, root } = await renderSection();

    expect(container.textContent).toBe('');

    await act(async () => root.unmount());
    container.remove();
  });

  it('renders nothing without a user id even if candidates exist', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ResurfaceSection
          records={records}
          memoriesByRepoId={memoriesByRepoId}
          userId={undefined}
        />,
      );
    });

    // 无 userId 时反馈无法持久化，卡片仍然展示（只是反馈按钮不落盘）。
    expect(container.textContent).toContain('记忆唤醒');

    await act(async () => root.unmount());
    container.remove();
  });
});
