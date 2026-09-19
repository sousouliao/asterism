import {
  type AskCandidate,
  type AskExchange,
  buildAskPrompt,
  findAskProvider,
  parseAskResponse,
  selectAskCandidates,
} from '@asterism/core';
import { invokeAskGenerate, type StarredRepoRecord } from '@asterism/db';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from '../auth/use-session';
import { useEmbeddingBootstrapContext } from '../contexts/embedding-bootstrap-context';
import { readAskByok } from '../lib/ask-byok';
import { supabase } from '../lib/supabase';
import { useMemoriesList } from './use-memories-list';
import { useSemanticNeighbors } from './use-semantic-search';
import { useStarredRepos } from './use-starred-repos';

/** 一轮完成的问答：问题、回答与其引用的候选（供证据卡片渲染）。 */
export interface AskTurn {
  /** 稳定标识（提交序号），供列表渲染作 key。 */
  id: number;
  question: string;
  summary: string;
  /** 本轮送入 prompt 的全部候选（索引与 prompt 一致）。 */
  candidates: AskCandidate<StarredRepoRecord>[];
  /** 通过校验的推荐（索引 ∈ candidates）。 */
  recommendations: { index: number; repoId: string }[];
}

export type AskPhase =
  | { kind: 'idle' }
  | { kind: 'recalling'; question: string }
  | { kind: 'generating'; question: string }
  | { kind: 'answered'; turn: AskTurn }
  | { kind: 'not_found'; question: string }
  | {
      kind: 'error';
      question: string;
      reason: 'retryable' | 'timeout' | 'invalid_key' | 'provider_rejected' | 'unparsable';
    };

interface Submission {
  id: number;
  question: string;
  history: AskExchange[];
}

/**
 * Ask Asterism 编排（GitHub #41，ADR 0042）：本地召回（词法 + 可选语义近邻）→
 * BYOK 生成 → 客户端引用校验。召回为空时不调用 LLM，直接进入 not_found；
 * embedding 未授权 / 未就绪时语义通道自动缺席，纯词法召回照常工作。
 */
export function useAskQuestion() {
  const { session } = useSession();
  const userId = session?.user.id;
  const byok = readAskByok(userId ?? '');
  const embedding = useEmbeddingBootstrapContext();
  const semanticEnabled =
    embedding.optedIn && (embedding.phase === 'ready' || embedding.backend !== null);

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [phase, setPhase] = useState<AskPhase>({ kind: 'idle' });
  const [turns, setTurns] = useState<AskTurn[]>([]);
  const nextId = useRef(1);
  const settledId = useRef(0);

  const reposQuery = useStarredRepos();
  const memoriesQuery = useMemoriesList();
  const memoriesByRepoId = useMemo(() => {
    const map = new Map();
    for (const memory of memoriesQuery.data ?? []) {
      map.set(memory.repoId, memory);
    }
    return map;
  }, [memoriesQuery.data]);

  const pendingQuestion = phase.kind === 'recalling' ? (submission?.question ?? '') : '';
  const { distanceByRepoId, isSearching } = useSemanticNeighbors(pendingQuestion, {
    enabled: semanticEnabled && phase.kind === 'recalling',
  });

  const ask = useCallback(
    (rawQuestion: string) => {
      const question = rawQuestion.trim();
      if (!question || !byok) {
        return;
      }
      const history: AskExchange[] = turns.map((turn) => ({
        question: turn.question,
        summary: turn.summary,
      }));
      setSubmission({ id: nextId.current, question, history });
      setPhase({ kind: 'recalling', question });
    },
    [byok, turns],
  );

  const reset = useCallback(() => {
    setSubmission(null);
    setPhase({ kind: 'idle' });
    setTurns([]);
  }, []);

  useEffect(() => {
    if (!submission || settledId.current === submission.id) {
      return;
    }
    const records = reposQuery.data;
    if (!records || (semanticEnabled && isSearching)) {
      // 仓库列表未到或语义检索仍在进行时等待；语义未启用则直接词法召回。
      return;
    }

    const token = submission.id;
    settledId.current = token;

    const run = async () => {
      const candidates = selectAskCandidates({
        question: submission.question,
        items: records,
        memoriesByRepoId,
        distanceByRepoId,
      });
      if (candidates.length === 0) {
        // 结构性防幻觉：召回为空不发起生成（ADR 0042）。
        setPhase({ kind: 'not_found', question: submission.question });
        return;
      }

      setPhase({ kind: 'generating', question: submission.question });
      const provider = findAskProvider(byok?.provider ?? '');
      const prompt = buildAskPrompt({
        question: submission.question,
        candidates,
        memoriesByRepoId,
        history: submission.history,
        language: document.documentElement.lang || undefined,
      });
      const outcome = await invokeAskGenerate(supabase, {
        provider: byok?.provider ?? '',
        model: byok?.model ?? provider?.defaultModel ?? '',
        providerKey: byok?.providerKey ?? '',
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
        ...(provider?.supportsJsonMode ? { responseFormat: 'json_object' as const } : {}),
      });

      if (outcome.status !== 'success') {
        setPhase({
          kind: 'error',
          question: submission.question,
          reason:
            outcome.status === 'timeout'
              ? 'timeout'
              : outcome.status === 'invalid_provider_key'
                ? 'invalid_key'
                : outcome.status === 'provider_rejected'
                  ? 'provider_rejected'
                  : 'retryable',
        });
        return;
      }
      const parsed = parseAskResponse(outcome.content, candidates);
      if (!parsed.ok) {
        setPhase({ kind: 'error', question: submission.question, reason: 'unparsable' });
        return;
      }
      const turn: AskTurn = {
        id: submission.id,
        question: submission.question,
        summary: parsed.answer.summary,
        candidates,
        recommendations: parsed.answer.recommendations,
      };
      setTurns((current) => [...current, turn]);
      setPhase({ kind: 'answered', turn });
    };

    void run();
  }, [
    submission,
    reposQuery.data,
    memoriesByRepoId,
    distanceByRepoId,
    isSearching,
    semanticEnabled,
    byok,
  ]);

  return { phase, turns, ask, reset, configured: Boolean(byok) };
}
