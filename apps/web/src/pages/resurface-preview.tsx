import type { Memory } from '@asterism/core';
import type { StarredRepoRecord } from '@asterism/db';
import { useTheme } from '@asterism/ui';
import { useMemo } from 'react';
import { RepoInspector } from '../components/repo-inspector';
import { ResurfaceSection } from '../components/resurface/resurface-section';
import { RepoInspectorProvider } from '../contexts/repo-inspector-context';
import { previewRepo } from '../fixtures/preview-repo';
import { changeInterfaceLanguage } from '../i18n';
import { resurfaceFeedbackStorageKey } from '../lib/resurface-feedback';

const DAY_MS = 86_400_000;
const PREVIEW_USER_ID = 'resurface-preview';

/**
 * 构造覆盖全部理由分支的样本：纪念日 + 笔记、沉睡 + whySaved + 仓库静默、
 * 缺原因 + 高价值 + 有笔记无原因、新收藏缺原因。时间相对 Date.now() 生成，
 * 保证预览在任何日期打开都能命中对应分支。
 */
function buildFixtures(): {
  records: StarredRepoRecord[];
  memoriesByRepoId: Map<string, Memory>;
} {
  const now = Date.now();
  const iso = (days: number) => new Date(now - days * DAY_MS).toISOString();

  const records: StarredRepoRecord[] = [
    {
      repoId: 'preview-anniversary',
      starredAt: iso(365 * 2),
      repo: previewRepo({
        githubId: 101,
        fullName: 'oven-sh/bun',
        name: 'bun',
        owner: 'oven-sh',
        description: 'Incredibly fast JavaScript runtime',
        language: 'Zig',
        stargazers: 76_000,
        pushedAt: iso(2),
      }),
    },
    {
      repoId: 'preview-dormant-quiet',
      starredAt: iso(365 * 3 + 80),
      repo: previewRepo({
        githubId: 102,
        fullName: 'legacy-tools/orchestrator',
        name: 'orchestrator',
        owner: 'legacy-tools',
        description: 'Workflow orchestrator from an earlier era',
        language: 'Python',
        stargazers: 4_200,
        pushedAt: iso(365 * 2 + 200),
        archived: true,
      }),
    },
    {
      repoId: 'preview-dormant-why',
      starredAt: iso(400),
      repo: previewRepo({
        githubId: 103,
        fullName: 'tokio-rs/axum',
        name: 'axum',
        owner: 'tokio-rs',
        description: 'Ergonomic and modular web framework',
        language: 'Rust',
        stargazers: 21_000,
        pushedAt: iso(3),
      }),
    },
    {
      repoId: 'preview-missing-noted',
      starredAt: iso(90),
      repo: previewRepo({
        githubId: 104,
        fullName: 'me/sharp-toolkit',
        name: 'sharp-toolkit',
        owner: 'me',
        description: 'Personal toolkit saved during a migration',
        language: 'Go',
        stargazers: 5_800,
        pushedAt: iso(20),
      }),
    },
    {
      repoId: 'preview-missing-fresh',
      starredAt: iso(64),
      repo: previewRepo({
        githubId: 105,
        fullName: 'small-team/niche-lib',
        name: 'niche-lib',
        owner: 'small-team',
        description: 'Niche library without any recorded intent',
        language: 'Lua',
        stargazers: 320,
        pushedAt: iso(30),
      }),
    },
  ];

  const memoriesByRepoId = new Map<string, Memory>([
    [
      'preview-anniversary',
      {
        repoId: 'preview-anniversary',
        source: 'github_star',
        sourceCreatedAt: iso(365 * 2),
        whySaved: null,
        note: '当时的替代运行时评估记录，性能数据在旧笔记里。',
      },
    ],
    [
      'preview-dormant-quiet',
      {
        repoId: 'preview-dormant-quiet',
        source: 'github_star',
        sourceCreatedAt: iso(365 * 3 + 80),
        whySaved: '旧项目的工作流引擎，迁移时参考过它的调度实现。',
        note: null,
      },
    ],
    [
      'preview-dormant-why',
      {
        repoId: 'preview-dormant-why',
        source: 'github_star',
        sourceCreatedAt: iso(400),
        whySaved: '下一版服务的 Web 框架首选。',
        note: null,
      },
    ],
    [
      'preview-missing-noted',
      {
        repoId: 'preview-missing-noted',
        source: 'github_star',
        sourceCreatedAt: iso(90),
        whySaved: null,
        note: '迁移期间存过一份配置片段，但一直没写收藏原因。',
      },
    ],
  ]);

  return { records, memoriesByRepoId };
}

export function ResurfacePreviewPage() {
  const { theme, setTheme } = useTheme();
  const { records, memoriesByRepoId } = useMemo(buildFixtures, []);

  return (
    <RepoInspectorProvider>
      <div className="flex h-svh flex-col bg-background text-foreground">
        <div className="shrink-0 px-6 pt-6">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3">
            <p className="text-body text-muted-foreground">
              Dev preview · fixtures only · feedback stays local
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void changeInterfaceLanguage('en')}
                className="rounded-md border px-2 py-1 text-caption"
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => void changeInterfaceLanguage('zh-CN')}
                className="rounded-md border px-2 py-1 text-caption"
              >
                中文
              </button>
              <button
                type="button"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="rounded-md border px-2 py-1 text-caption"
              >
                {theme === 'dark' ? 'Light' : 'Dark'}
              </button>
              <button
                type="button"
                onClick={() => {
                  // 只清预览自己的反馈键：localStorage.clear() 会顺手登出真实会话。
                  localStorage.removeItem(resurfaceFeedbackStorageKey(PREVIEW_USER_ID));
                  location.reload();
                }}
                className="rounded-md border px-2 py-1 text-caption"
              >
                Reset feedback
              </button>
            </div>
          </div>
        </div>

        <div className="asterism-scroll-gutter min-h-0 flex-1 overflow-y-auto px-6 pb-6">
          <main className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            <ResurfaceSection
              records={records}
              memoriesByRepoId={memoriesByRepoId}
              userId={PREVIEW_USER_ID}
            />
          </main>
        </div>

        <RepoInspector />
      </div>
    </RepoInspectorProvider>
  );
}
