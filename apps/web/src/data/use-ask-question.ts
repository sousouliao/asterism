import {
  type AskCandidate,
  type AskExchange,
  buildAskPrompt,
  parseAskResponse,
  selectAskCandidates,
  splitAskStream,
} from '@asterism/core';
import { type StarredRepoRecord, streamAskGenerate } from '@asterism/db';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from '../auth/use-session';
import { useEmbeddingBootstrapContext } from '../contexts/embedding-bootstrap-context';
import { useAiSettingsValue } from '../lib/ai-connections';
import { useAskByok } from '../lib/ask-byok';
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
  | { kind: 'generating'; question: string; text: string }
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

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

/**
 * Ask Asterism 编排（GitHub #41，ADR 0042 / 0044）：本地召回（词法 + 可选语义近邻）→
 * BYOK 流式生成 → 客户端引用校验。召回为空时不调用 LLM，直接进入 not_found；
 * embedding 未授权 / 未就绪时语义通道自动缺席，纯词法召回照常工作。
 */
export function useAskQuestion() {
  const { session } = useSession();
  const userId = session?.user.id;
  // 订阅而非快照读取：Settings 里改 key、停用连接或撤销同意时，本 Hook 立即
  // 反映最新状态，不会继续使用已失效的凭据。
  const byok = useAskByok(userId);
  const includeNotes = useAiSettingsValue(userId).includeNotesInAi;
  const embedding = useEmbeddingBootstrapContext();
  const semanticEnabled =
    embedding.optedIn && (embedding.phase === 'ready' || embedding.backend !== null);

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [phase, setPhase] = useState<AskPhase>({ kind: 'idle' });
  const [turns, setTurns] = useState<AskTurn[]>([]);
  const nextId = useRef(1);
  const settledId = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const stopRef = useRef(false);
  const deltaRef = useRef('');
  const rafRef = useRef<number | null>(null);

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

  const cancelInFlight = useCallback((asStop: boolean) => {
    stopRef.current = asStop;
    abortRef.current?.abort();
    abortRef.current = null;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const ask = useCallback(
    (rawQuestion: string) => {
      const question = rawQuestion.trim();
      if (!question || !byok) {
        return;
      }
      cancelInFlight(false);
      const history: AskExchange[] = turns.map((turn) => ({
        question: turn.question,
        summary: turn.summary,
      }));
      // id 必须逐次自增：effect 以 settledId 防重入，同 id 的后续提交（追问 / 重试）
      // 会被视为已处理而永远停在 recalling。
      const id = nextId.current;
      nextId.current += 1;
      setSubmission({ id, question, history });
      setPhase({ kind: 'recalling', question });
    },
    [byok, cancelInFlight, turns],
  );

  const stop = useCallback(() => {
    if (phase.kind !== 'generating') {
      return;
    }
    cancelInFlight(true);
  }, [cancelInFlight, phase.kind]);

  const reset = useCallback(() => {
    cancelInFlight(false);
    setSubmission(null);
    setPhase({ kind: 'idle' });
    setTurns([]);
  }, [cancelInFlight]);

  useEffect(() => {
    if (!submission || settledId.current === submission.id) {
      return;
    }
    if (!byok) {
      // 问答途中连接被停用 / key 被轮换 / 同意被撤销：立即停下，回到未配置态，
      // 绝不拿已失效的凭据继续出网。面板会转为配置引导。
      settledId.current = submission.id;
      setSubmission(null);
      setPhase({ kind: 'idle' });
      return;
    }
    const records = reposQuery.data;
    if (!records || (semanticEnabled && isSearching)) {
      // 仓库列表未到或语义检索仍在进行时等待；语义未启用则直接词法召回。
      return;
    }

    const token = submission.id;
    settledId.current = token;
    stopRef.current = false;
    deltaRef.current = '';

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

      setPhase({ kind: 'generating', question: submission.question, text: '' });
      const prompt = buildAskPrompt({
        question: submission.question,
        candidates,
        memoriesByRepoId,
        history: submission.history,
        language: document.documentElement.lang || undefined,
        includeNotes,
      });
      const controller = new AbortController();
      abortRef.current = controller;

      const flushText = () => {
        rafRef.current = null;
        if (settledId.current !== token) {
          return;
        }
        setPhase({
          kind: 'generating',
          question: submission.question,
          text: splitAskStream(deltaRef.current).body,
        });
      };

      const settle = (raw: string, allowEmpty: boolean) => {
        const parsed = parseAskResponse(raw, candidates);
        if (!parsed.ok) {
          if (allowEmpty) {
            setPhase({ kind: 'idle' });
            return;
          }
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

      try {
        const outcome = await streamAskGenerate(
          supabase,
          {
            provider: byok.provider,
            model: byok.model,
            providerKey: byok.providerKey,
            messages: [
              { role: 'system', content: prompt.system },
              { role: 'user', content: prompt.user },
            ],
          },
          {
            signal: controller.signal,
            onDelta: (text) => {
              if (settledId.current !== token) {
                return;
              }
              deltaRef.current += text;
              if (rafRef.current === null) {
                rafRef.current = requestAnimationFrame(flushText);
              }
            },
          },
        );

        if (settledId.current !== token) {
          return;
        }
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }

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
        settle(outcome.content, false);
      } catch (error) {
        if (settledId.current !== token) {
          return;
        }
        if (isAbortError(error) && stopRef.current) {
          settle(deltaRef.current, true);
          return;
        }
        if (isAbortError(error)) {
          return;
        }
        setPhase({ kind: 'error', question: submission.question, reason: 'retryable' });
      }
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
    includeNotes,
  ]);

  return { phase, turns, ask, stop, reset, configured: Boolean(byok) };
}
