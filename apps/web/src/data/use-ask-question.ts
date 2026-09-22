import {
  ASK_TOOL_DEFINITIONS,
  type AskCandidate,
  type AskExchange,
  type AskLoopState,
  buildAskCatalog,
  buildAskPrompt,
  canContinueAskLoop,
  createAskLoopState,
  executeAskTool,
  noteAskToolRound,
  parseAskResponse,
  splitAskStream,
} from '@asterism/core';
import { type AskGenerateMessage, type StarredRepoRecord, streamAskGenerate } from '@asterism/db';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from '../auth/use-session';
import { getAvailableAiModels, useAiSettingsValue } from '../lib/ai-connections';
import { useAskByok } from '../lib/ask-byok';
import {
  type AskSessionRecord,
  clearAllAskSessions,
  deleteAskSession,
  formatSessionTitle,
  getAskSessions,
  saveAskSession,
} from '../lib/ask-session-storage';
import { supabase } from '../lib/supabase';
import { useAiConnections, useUpdateAiSettings } from './use-ai-connections';
import { useLibraryRepos } from './use-library-repos';
import { useMemoriesList } from './use-memories-list';

/** 一轮完成的问答：问题、回答与通过 read gate 的推荐。 */
export interface AskTurn {
  /** 稳定标识（提交序号），供列表渲染作 key。 */
  id: number;
  question: string;
  summary: string;
  recommendations: AskCandidate<StarredRepoRecord>[];
}

export type AskPhase =
  | { kind: 'idle' }
  | { kind: 'generating'; question: string; text: string; toolLabel?: string }
  | { kind: 'answered'; turn: AskTurn }
  | { kind: 'not_found'; question: string }
  | {
      kind: 'budget_exhausted';
      question: string;
      text: string;
      recommendations: AskCandidate<StarredRepoRecord>[];
    }
  | {
      kind: 'error';
      question: string;
      reason: 'retryable' | 'timeout' | 'invalid_key' | 'provider_rejected' | 'unparsable';
    };

interface Submission {
  id: number;
  question: string;
  history: AskExchange[];
  resume?: boolean;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function toCandidate(record: StarredRepoRecord): AskCandidate<StarredRepoRecord> {
  return { item: record, repoId: record.repoId, lexicalScore: null, reasons: [] };
}

function mapRecommendations(
  repoIds: readonly { repoId: string }[],
  records: readonly StarredRepoRecord[],
): AskCandidate<StarredRepoRecord>[] {
  const byId = new Map(records.map((record) => [record.repoId, record]));
  return repoIds.flatMap((entry) => {
    const record = byId.get(entry.repoId);
    return record ? [toCandidate(record)] : [];
  });
}

function toolLabelFor(name: string): string {
  if (name === 'filter') {
    return 'filtering';
  }
  if (name === 'search') {
    return 'searching';
  }
  if (name === 'expand') {
    return 'expanding';
  }
  return 'working';
}

/**
 * Ask Asterism 编排（GitHub #41，ADR 0045 / 0046）：目录常驻 Agent 循环，唯一路径。
 * 不按模型能力分流——不会调工具的模型照样拿到完整目录，只是没有推荐卡片。
 * 空库不调用 LLM。
 */
export function useAskQuestion() {
  const { session } = useSession();
  const userId = session?.user.id;
  const byok = useAskByok(userId);
  const includeNotes = useAiSettingsValue(userId).includeNotesInAi;
  const connectionsQuery = useAiConnections();
  const updateSettings = useUpdateAiSettings();

  const connections = connectionsQuery.data ?? [];
  const availableModels = useMemo(() => getAvailableAiModels(connections), [connections]);
  const currentModel = byok?.model ?? null;

  const selectModel = useCallback(
    (targetModel: string) => {
      const match = availableModels.find((candidate) => candidate.model === targetModel);
      if (!match) {
        return;
      }
      updateSettings.mutate({
        generationConnectionId: match.connectionId,
        selectedModel: match.model,
      });
    },
    [availableModels, updateSettings],
  );

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [phase, setPhase] = useState<AskPhase>({ kind: 'idle' });
  const [turns, setTurns] = useState<AskTurn[]>([]);
  const [sessions, setSessions] = useState<AskSessionRecord[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);
  const nextId = useRef(1);
  const settledId = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const stopRef = useRef(false);
  const deltaRef = useRef('');
  const rafRef = useRef<number | null>(null);
  const resumeRef = useRef<{
    messages: AskGenerateMessage[];
    loop: AskLoopState;
    question: string;
  } | null>(null);

  const reposQuery = useLibraryRepos();
  const memoriesQuery = useMemoriesList();
  const memoriesByRepoId = useMemo(() => {
    const map = new Map();
    for (const memory of memoriesQuery.data ?? []) {
      map.set(memory.repoId, memory);
    }
    return map;
  }, [memoriesQuery.data]);

  const refreshSessions = useCallback(async () => {
    try {
      const records = await getAskSessions();
      setSessions(records);
    } catch {
      // 忽略读取错误
    }
  }, []);

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  const cancelInFlight = useCallback((asStop: boolean) => {
    stopRef.current = asStop;
    abortRef.current?.abort();
    abortRef.current = null;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const appendTurnAndPersist = useCallback((turn: AskTurn) => {
    const sessionId = activeSessionIdRef.current ?? crypto.randomUUID();
    activeSessionIdRef.current = sessionId;
    setCurrentSessionId(sessionId);

    setTurns((current) => {
      const nextTurns = [...current, turn];
      void (async () => {
        try {
          const allSessions = await getAskSessions();
          const existing = allSessions.find((s) => s.id === sessionId);
          const record: AskSessionRecord = {
            id: sessionId,
            title: existing?.title ?? formatSessionTitle(nextTurns[0]?.question ?? turn.question),
            createdAt: existing?.createdAt ?? Date.now(),
            updatedAt: Date.now(),
            turns: nextTurns,
          };
          await saveAskSession(record);
          const refreshed = await getAskSessions();
          setSessions(refreshed);
        } catch {
          // 忽略持久化异常
        }
      })();
      return nextTurns;
    });
    setPhase({ kind: 'answered', turn });
  }, []);

  const ask = useCallback(
    (rawQuestion: string) => {
      const question = rawQuestion.trim();
      if (!question || !byok) {
        return;
      }
      cancelInFlight(false);
      resumeRef.current = null;
      const history: AskExchange[] = turns.map((turn) => ({
        question: turn.question,
        summary: turn.summary,
      }));
      const id = nextId.current;
      nextId.current += 1;
      setSubmission({ id, question, history });
      setPhase({ kind: 'generating', question, text: '' });
    },
    [byok, cancelInFlight, turns],
  );

  const continueAsk = useCallback(() => {
    if (!byok || !resumeRef.current || phase.kind !== 'budget_exhausted') {
      return;
    }
    cancelInFlight(false);
    const id = nextId.current;
    nextId.current += 1;
    setSubmission({ id, question: resumeRef.current.question, history: [], resume: true });
    setPhase({ kind: 'generating', question: resumeRef.current.question, text: '' });
  }, [byok, cancelInFlight, phase.kind]);

  const stop = useCallback(() => {
    if (phase.kind !== 'generating') {
      return;
    }
    cancelInFlight(true);
  }, [cancelInFlight, phase.kind]);

  const startNewSession = useCallback(() => {
    cancelInFlight(false);
    resumeRef.current = null;
    activeSessionIdRef.current = null;
    setCurrentSessionId(null);
    setSubmission(null);
    setPhase({ kind: 'idle' });
    setTurns([]);
  }, [cancelInFlight]);

  const reset = startNewSession;

  const loadSession = useCallback(
    (session: AskSessionRecord) => {
      cancelInFlight(false);
      resumeRef.current = null;
      activeSessionIdRef.current = session.id;
      setCurrentSessionId(session.id);
      setSubmission(null);
      setTurns(session.turns);
      const maxId = session.turns.reduce((max, t) => Math.max(max, t.id), 0);
      nextId.current = Math.max(nextId.current, maxId + 1);

      const lastTurn = session.turns[session.turns.length - 1];
      if (lastTurn) {
        setPhase({ kind: 'answered', turn: lastTurn });
      } else {
        setPhase({ kind: 'idle' });
      }
    },
    [cancelInFlight],
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      await deleteAskSession(sessionId);
      if (activeSessionIdRef.current === sessionId) {
        startNewSession();
      }
      await refreshSessions();
    },
    [refreshSessions, startNewSession],
  );

  const clearAllSessions = useCallback(async () => {
    await clearAllAskSessions();
    startNewSession();
    setSessions([]);
  }, [startNewSession]);

  useEffect(() => {
    if (!submission || settledId.current === submission.id) {
      return;
    }
    if (!byok) {
      settledId.current = submission.id;
      setSubmission(null);
      setPhase({ kind: 'idle' });
      return;
    }
    const records = reposQuery.data;
    if (!records) {
      return;
    }

    const token = submission.id;
    settledId.current = token;
    stopRef.current = false;
    deltaRef.current = '';

    const run = async () => {
      if (records.length === 0) {
        setPhase({ kind: 'not_found', question: submission.question });
        return;
      }

      await runAgent(token, records);
    };

    const flushText = (question: string, toolLabel?: string) => {
      rafRef.current = null;
      if (settledId.current !== token) {
        return;
      }
      setPhase({
        kind: 'generating',
        question,
        text: splitAskStream(deltaRef.current).body,
        toolLabel,
      });
    };

    const streamOnce = async (
      messages: AskGenerateMessage[],
      question: string,
      withTools: boolean,
    ) => {
      const controller = new AbortController();
      abortRef.current = controller;
      deltaRef.current = '';
      const outcome = await streamAskGenerate(
        supabase,
        {
          provider: byok.provider,
          model: byok.model,
          providerKey: byok.providerKey,
          messages,
          ...(withTools ? { tools: [...ASK_TOOL_DEFINITIONS] } : {}),
        },
        {
          signal: controller.signal,
          onDelta: (text) => {
            if (settledId.current !== token) {
              return;
            }
            deltaRef.current += text;
            if (rafRef.current === null) {
              rafRef.current = requestAnimationFrame(() => flushText(question));
            }
          },
        },
      );
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return outcome;
    };

    const runAgent = async (currentToken: number, records: StarredRepoRecord[]) => {
      const catalog = buildAskCatalog({ items: records });
      const prompt = buildAskPrompt({
        question: submission.question,
        catalog: catalog.text,
        history: submission.resume ? undefined : submission.history,
        language: document.documentElement.lang || undefined,
        includeNotes,
      });
      const toolContext = { items: records, memoriesByRepoId, includeNotes };
      let messages: AskGenerateMessage[] = submission.resume
        ? (resumeRef.current?.messages ?? [])
        : [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user },
          ];
      let loop = submission.resume
        ? {
            ...createAskLoopState(),
            expandedRepoIds: resumeRef.current?.loop.expandedRepoIds ?? [],
          }
        : createAskLoopState();

      setPhase({ kind: 'generating', question: submission.question, text: '' });

      try {
        while (true) {
          const outcome = await streamOnce(messages, submission.question, true);
          if (settledId.current !== currentToken) {
            return;
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

          if (outcome.toolCalls.length > 0) {
            messages = [
              ...messages,
              {
                role: 'assistant',
                content: outcome.content,
                tool_calls: outcome.toolCalls.map((call) => ({
                  id: call.id,
                  type: 'function',
                  function: { name: call.name, arguments: call.arguments },
                })),
              },
            ];
            let resultChars = 0;
            const expandedIds: string[] = [];
            for (const call of outcome.toolCalls) {
              setPhase({
                kind: 'generating',
                question: submission.question,
                text: '',
                toolLabel: toolLabelFor(call.name),
              });
              const executed = executeAskTool(toolContext, call.name, call.arguments);
              const payload = executed.ok
                ? JSON.stringify(executed.result)
                : JSON.stringify({ error: executed.error });
              resultChars += payload.length;
              if (executed.ok) {
                expandedIds.push(...executed.expandedIds);
              }
              messages = [...messages, { role: 'tool', tool_call_id: call.id, content: payload }];
            }
            loop = noteAskToolRound(loop, { resultChars, expandedIds });
            if (!canContinueAskLoop(loop)) {
              const closing = await streamOnce(messages, submission.question, false);
              if (settledId.current !== currentToken) {
                return;
              }
              if (closing.status !== 'success') {
                setPhase({
                  kind: 'error',
                  question: submission.question,
                  reason: 'retryable',
                });
                return;
              }
              const parsed = parseAskResponse(closing.content, loop.expandedRepoIds);
              const recommendations = parsed.ok
                ? mapRecommendations(parsed.answer.recommendations, records)
                : [];
              const text = parsed.ok ? parsed.answer.summary : splitAskStream(closing.content).body;
              resumeRef.current = { messages, loop, question: submission.question };
              setPhase({
                kind: 'budget_exhausted',
                question: submission.question,
                text,
                recommendations,
              });
              return;
            }
            continue;
          }

          const parsed = parseAskResponse(outcome.content, loop.expandedRepoIds);
          if (!parsed.ok) {
            if (stopRef.current) {
              setPhase({ kind: 'idle' });
              return;
            }
            setPhase({ kind: 'error', question: submission.question, reason: 'unparsable' });
            return;
          }
          resumeRef.current = null;
          const turn: AskTurn = {
            id: submission.id,
            question: submission.question,
            summary: parsed.answer.summary,
            recommendations: mapRecommendations(parsed.answer.recommendations, records),
          };
          appendTurnAndPersist(turn);
          return;
        }
      } catch (error) {
        if (settledId.current !== currentToken) {
          return;
        }
        if (isAbortError(error) && stopRef.current) {
          const parsed = parseAskResponse(deltaRef.current, loop.expandedRepoIds);
          if (parsed.ok) {
            const turn: AskTurn = {
              id: submission.id,
              question: submission.question,
              summary: parsed.answer.summary,
              recommendations: mapRecommendations(parsed.answer.recommendations, records),
            };
            appendTurnAndPersist(turn);
            return;
          }
          setPhase({ kind: 'idle' });
          return;
        }
        if (isAbortError(error)) {
          return;
        }
        setPhase({ kind: 'error', question: submission.question, reason: 'retryable' });
      }
    };

    void run();
  }, [submission, reposQuery.data, memoriesByRepoId, byok, includeNotes, appendTurnAndPersist]);

  return {
    phase,
    turns,
    ask,
    continueAsk,
    stop,
    reset,
    configured: Boolean(byok),
    currentModel,
    availableModels,
    selectModel,
    currentSessionId,
    sessions,
    loadSession,
    startNewSession,
    deleteSession,
    clearAllSessions,
    refreshSessions,
  };
}
