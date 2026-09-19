import type { AskCandidate, Repo } from '@asterism/core';
import type { StarredRepoRecord } from '@asterism/db';
import { useState } from 'react';
import { AskThread } from '../components/ask/ask-panel';
import { RepoInspector } from '../components/repo-inspector';
import { RepoInspectorProvider, useRepoInspector } from '../contexts/repo-inspector-context';
import type { AskPhase, AskTurn } from '../data/use-ask-question';
import { changeInterfaceLanguage } from '../i18n';

function previewRepo(overrides: Partial<Repo>): Repo {
  return {
    githubId: 1,
    fullName: 'owner/name',
    name: 'name',
    owner: 'owner',
    description: 'Fixture repository for the Ask preview',
    language: 'TypeScript',
    topics: ['preview'],
    stargazers: 500,
    forks: 12,
    homepage: null,
    pushedAt: null,
    repoCreatedAt: null,
    archived: false,
    isFork: false,
    syncedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const PREVIEW_RECORDS: StarredRepoRecord[] = [
  {
    repoId: 'preview-ws',
    starredAt: '2024-05-01T00:00:00Z',
    repo: previewRepo({
      githubId: 101,
      fullName: 'rustws/tungstenite',
      name: 'tungstenite',
      owner: 'rustws',
      description: 'Lightweight WebSocket stream implementation',
      language: 'Rust',
      topics: ['websocket', 'network'],
      stargazers: 1800,
    }),
  },
  {
    repoId: 'preview-virtua',
    starredAt: '2025-02-10T00:00:00Z',
    repo: previewRepo({
      githubId: 102,
      fullName: 'inokawa/virtua',
      name: 'virtua',
      owner: 'inokawa',
      description: 'A virtual scroll library for React and Vue',
      language: 'TypeScript',
      topics: ['virtual-scroll'],
      stargazers: 1600,
    }),
  },
];

const PREVIEW_CANDIDATES: AskCandidate<StarredRepoRecord>[] = [
  {
    item: PREVIEW_RECORDS[0] as StarredRepoRecord,
    repoId: 'preview-ws',
    lexicalScore: 11,
    reasons: [
      { kind: 'note', snippet: 'push latency is fine', fullText: 'push latency is fine' },
      {
        kind: 'description',
        snippet: 'Lightweight WebSocket…',
        fullText: 'Lightweight WebSocket stream implementation',
      },
    ],
  },
  {
    item: PREVIEW_RECORDS[1] as StarredRepoRecord,
    repoId: 'preview-virtua',
    lexicalScore: null,
    semanticDistance: 0.38,
    reasons: [
      {
        kind: 'semantic_repo',
        snippet: 'A virtual scroll library',
        fullText: 'A virtual scroll library for React and Vue',
      },
    ],
  },
];

const ANSWERED_TURN: AskTurn = {
  id: 1,
  question: 'Which rust websocket library did I save?',
  summary:
    'Based on your collection, [0] rustws/tungstenite is the closest match — your note mentions using it for push with acceptable latency, and its description highlights a lightweight WebSocket implementation. [1] inokawa/virtua is only semantically close and does not answer the WebSocket question directly.',
  candidates: PREVIEW_CANDIDATES,
  recommendations: [
    { index: 0, repoId: 'preview-ws' },
    { index: 1, repoId: 'preview-virtua' },
  ],
};

const PHASES: { label: string; phase: AskPhase; turns?: AskTurn[] }[] = [
  { label: 'answered', phase: { kind: 'answered', turn: ANSWERED_TURN }, turns: [ANSWERED_TURN] },
  { label: 'recalling', phase: { kind: 'recalling', question: 'virtual scroll tools?' } },
  { label: 'generating', phase: { kind: 'generating', question: 'virtual scroll tools?' } },
  { label: 'not_found', phase: { kind: 'not_found', question: 'kubernetes operators?' } },
  { label: 'error · retryable', phase: { kind: 'error', question: 'any', reason: 'retryable' } },
  {
    label: 'error · invalid key',
    phase: { kind: 'error', question: 'any', reason: 'invalid_key' },
  },
  {
    label: 'follow-up · history + in-flight',
    phase: { kind: 'generating', question: 'which of those is lighter?' },
    turns: [ANSWERED_TURN],
  },
];

function AskPreviewContent() {
  const inspector = useRepoInspector();
  const [language, setLanguage] = useState<'en' | 'zh-CN'>('en');
  const openRepo: Parameters<typeof AskThread>[0]['onOpenRepo'] = (record, records, modality) => {
    inspector.requestOpen(record, { sourceKey: 'ask-preview', records }, modality);
  };

  return (
    <div className="asterism-scroll-gutter -m-6 min-h-0 flex-1 overflow-y-auto px-6 py-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="flex items-center justify-between gap-4">
          <h1 className="font-semibold text-page-title text-foreground">Ask Asterism preview</h1>
          <button
            type="button"
            className="text-caption text-link hover:underline"
            onClick={() => {
              const next = language === 'en' ? 'zh-CN' : 'en';
              setLanguage(next);
              void changeInterfaceLanguage(next);
            }}
          >
            {language === 'en' ? '切换中文' : 'Switch to English'}
          </button>
        </header>
        {PHASES.map(({ label, phase, turns }) => (
          <section key={label} className="flex flex-col gap-3">
            <h2 className="font-medium text-sm text-muted-foreground">{label}</h2>
            <div className="flex max-h-96 flex-col gap-6 overflow-y-auto rounded-lg border p-4">
              <AskThread
                turns={turns ?? []}
                phase={phase}
                onOpenRepo={openRepo}
                onRetry={() => {}}
                onOpenSettings={() => {}}
              />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/** dev-only 预览（不进生产包）：用 fixture 覆盖 Ask 面板各状态分支，供视觉 QA。 */
export function AskPreviewPage() {
  return (
    <RepoInspectorProvider>
      <AskPreviewContent />
      <RepoInspector />
    </RepoInspectorProvider>
  );
}
