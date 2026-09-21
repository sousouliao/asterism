import type { AskCandidate } from '@asterism/core';
import type { StarredRepoRecord } from '@asterism/db';
import { Button } from '@asterism/ui';
import { useState } from 'react';
import { AskDockContent, AskThread, type AskViewState } from '../components/ask/ask-panel';
import { RepoInspector } from '../components/repo-inspector';
import { RepoInspectorProvider, useRepoInspector } from '../contexts/repo-inspector-context';
import type { AskPhase, AskTurn } from '../data/use-ask-question';
import { previewRepo } from '../fixtures/preview-repo';
import { changeInterfaceLanguage } from '../i18n';

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
    'Based on your collection, rustws/tungstenite is the closest match — your note mentions using it for push with acceptable latency, and its description highlights a lightweight WebSocket implementation.',
  recommendations: PREVIEW_CANDIDATES,
};

const MULTI_TURN: AskTurn[] = [
  ANSWERED_TURN,
  {
    id: 2,
    question: 'Which of those is lighter for an embedded client?',
    summary:
      '[1] inokawa/virtua is the lighter pick — it is a single dependency focused on virtualization, while [0] rustws/tungstenite targets the WebSocket protocol layer itself and pulls in more of a runtime footprint.',
    recommendations: [PREVIEW_CANDIDATES[1] as (typeof PREVIEW_CANDIDATES)[number]],
  },
];

const PHASES: { label: string; phase: AskPhase; turns?: AskTurn[] }[] = [
  { label: 'answered', phase: { kind: 'answered', turn: ANSWERED_TURN }, turns: [ANSWERED_TURN] },
  {
    label: 'multi-turn',
    phase: { kind: 'answered', turn: MULTI_TURN[1] as AskTurn },
    turns: MULTI_TURN,
  },
  {
    label: 'filtering',
    phase: {
      kind: 'generating',
      question: 'virtual scroll tools?',
      text: '',
      toolLabel: 'filtering',
    },
  },
  {
    label: 'generating',
    phase: { kind: 'generating', question: 'virtual scroll tools?', text: '' },
  },
  {
    label: 'generating · stream',
    phase: {
      kind: 'generating',
      question: 'virtual scroll tools?',
      text: 'Your collection already has **[0] rustws/tungstenite** for the protocol layer.',
    },
  },
  { label: 'not_found', phase: { kind: 'not_found', question: 'kubernetes operators?' } },
  {
    label: 'budget exhausted',
    phase: {
      kind: 'budget_exhausted',
      question: 'compare rust web frameworks',
      text: 'I expanded axum so far.',
      recommendations: [PREVIEW_CANDIDATES[0] as (typeof PREVIEW_CANDIDATES)[number]],
    },
  },
  { label: 'error · retryable', phase: { kind: 'error', question: 'any', reason: 'retryable' } },
  {
    label: 'error · invalid key',
    phase: { kind: 'error', question: 'any', reason: 'invalid_key' },
  },
  {
    label: 'follow-up · history + in-flight',
    phase: { kind: 'generating', question: 'which of those is lighter?', text: '' },
    turns: [ANSWERED_TURN],
  },
  { label: 'idle', phase: { kind: 'idle' }, turns: [] },
];

/** 底部舱预览用状态面：真实 DialogContent + composer，仅数据为 fixture。 */
const DOCK_FIXTURES: { label: string; ask: AskViewState }[] = [
  ...PHASES.map(({ label, phase, turns }) => ({
    label,
    ask: {
      phase,
      turns: turns ?? [],
      ask: () => {},
      continueAsk: () => {},
      configured: true,
    } satisfies AskViewState,
  })),
  {
    label: 'needs setup',
    ask: {
      phase: { kind: 'idle' },
      turns: [],
      ask: () => {},
      configured: false,
    } satisfies AskViewState,
  },
];

function AskPreviewContent() {
  const inspector = useRepoInspector();
  const [language, setLanguage] = useState<'en' | 'zh-CN'>('en');
  const [activeDock, setActiveDock] = useState<string | null>(null);
  const openRepo: Parameters<typeof AskThread>[0]['onOpenRepo'] = (record, records, modality) => {
    inspector.requestOpen(record, { sourceKey: 'ask-preview', records }, modality);
  };
  const activeFixture = DOCK_FIXTURES.find((fixture) => fixture.label === activeDock);
  return (
    <div className="asterism-scroll-gutter -m-6 min-h-0 flex-1 overflow-y-auto px-6 py-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 pb-40">
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

        <section className="flex flex-col gap-3">
          <h2 className="font-medium text-sm text-muted-foreground">bottom dock · real chrome</h2>
          <p className="text-caption text-muted-foreground">
            直接在真实的底部输入区查看各状态（composer、定位与生长均为生产实现）；
            点击其它状态按钮即可切换。
          </p>
          <div className="flex flex-wrap gap-2">
            {DOCK_FIXTURES.map(({ label }) => (
              <Button
                key={label}
                size="xs"
                variant={label === activeDock ? 'default' : 'outline'}
                onClick={() => setActiveDock(label)}
              >
                {label}
              </Button>
            ))}
          </div>
        </section>

        {PHASES.map(({ label, phase, turns }) => (
          <section key={label} className="flex flex-col gap-3">
            <h2 className="font-medium text-sm text-muted-foreground">{label}</h2>
            <div className="flex max-h-96 flex-col gap-5 overflow-y-auto rounded-lg border p-4">
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

      {activeFixture ? (
        <AskDockContent
          ask={{
            ...activeFixture.ask,
            reset: () => setActiveDock(null),
          }}
        />
      ) : null}
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
