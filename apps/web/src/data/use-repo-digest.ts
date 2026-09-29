import {
  buildRepoDigestPrompt,
  parseRepoDigest,
  type RepoDigestData,
  repoFullName,
} from '@asterism/core';
import { type StarredRepoRecord, streamAskGenerate } from '@asterism/db';
import { QueryClient, QueryClientContext } from '@tanstack/react-query';
import { useCallback, useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../auth/use-session';
import { useAskByok } from '../lib/ask-byok';
import { clearRepoDigest, saveRepoDigest, useRepoDigest } from '../lib/repo-digest-storage';
import { supabase } from '../lib/supabase';
import { repoKeys } from './keys';
import { loadRepoReadme } from './use-repo-readme';

export type RepoDigestStatus = 'idle' | 'generating' | 'completed' | 'unconfigured' | 'error';

export interface UseRepoDigestResult {
  status: RepoDigestStatus;
  data: RepoDigestData | null;
  error: string | null;
  generate: () => Promise<void>;
  regenerate: () => Promise<void>;
  configureKey: () => void;
}

export function useRepoDigestManager(
  record: StarredRepoRecord | null | undefined,
): UseRepoDigestResult {
  const { session } = useSession();
  const { i18n } = useTranslation();
  const navigate = useNavigate();

  const queryClient = useContext(QueryClientContext) ?? null;

  const userId = session?.user.id;
  const repoId = record?.repoId;
  const byok = useAskByok(userId);
  const cachedDigest = useRepoDigest(userId, repoId);

  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const configureKey = useCallback(() => {
    navigate('/settings');
  }, [navigate]);

  const executeGenerate = useCallback(async () => {
    if (!record || !userId) return;

    if (!byok) {
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const { repo } = record;
      const [owner, name] = [repo.owner, repo.name];

      // 1. 获取 README（若已缓存则秒读，否则经 API 加载）
      const qc = queryClient ?? new QueryClient();
      const queryKey = repoKeys.readme(userId, owner, name);
      const readmeOutcome = await loadRepoReadme({
        client: supabase,
        queryClient: qc,
        queryKey,
        owner,
        name,
        providerToken: session?.provider_token ?? undefined,
      });

      const readmeContent = readmeOutcome.status === 'success' ? readmeOutcome.html : null;

      // 2. 组装符合 writing-for-agents 的严谨 Prompt
      const prompt = buildRepoDigestPrompt({
        fullName: repoFullName(repo),
        description: repo.description,
        language: repo.language,
        topics: repo.topics,
        readme: readmeContent,
        targetLocale: i18n.language,
      });

      // 3. 调用 ask-generate 代理接口
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
          onDelta: () => {},
        },
      );

      if (outcome.status !== 'success') {
        setErrorMessage(outcome.status);
        return;
      }

      // 4. 解析结构化 3 要素
      const parsed = parseRepoDigest(outcome.content);
      if (!parsed) {
        setErrorMessage('Failed to parse structured digest');
        return;
      }

      // 5. 本地持久化缓存
      saveRepoDigest(userId, record.repoId, parsed);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unknown generation error');
    } finally {
      setIsGenerating(false);
    }
  }, [record, userId, byok, queryClient, session?.provider_token, i18n.language]);

  const regenerate = useCallback(async () => {
    if (userId && repoId) {
      clearRepoDigest(userId, repoId);
    }
    await executeGenerate();
  }, [userId, repoId, executeGenerate]);

  // 状态判定：已缓存优先（即使 Key 过期仍可读取历史生成）；未配置 Key 引导；生成中；静默未生成
  let status: RepoDigestStatus = 'idle';
  if (cachedDigest) {
    status = isGenerating ? 'generating' : 'completed';
  } else if (isGenerating) {
    status = 'generating';
  } else if (!byok) {
    status = 'unconfigured';
  } else if (errorMessage) {
    status = 'error';
  }

  return {
    status,
    data: cachedDigest,
    error: errorMessage,
    generate: executeGenerate,
    regenerate,
    configureKey,
  };
}
