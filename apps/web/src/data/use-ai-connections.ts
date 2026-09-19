import { readTestedModel } from '@asterism/core';
import { invokeAskModels, invokeAskTest } from '@asterism/db';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../auth/use-session';
import {
  type AiConnection,
  type AiSettings,
  readAiConnections,
  readAiSettings,
  writeAiConnections,
  writeAiSettings,
} from '../lib/ai-connections';
import { clearAskByok, saveAskByok } from '../lib/ask-byok';
import { supabase } from '../lib/supabase';
import { aiConnectionKeys, aiSettingsKeys } from './keys';

const NO_USER = 'NO_USER';

/** 展示用凭据提示：前三个字符 + 省略号 + 末四位，不回显完整 key。 */
function credentialHint(apiKey: string): string | null {
  const trimmed = apiKey.trim();
  if (trimmed.length <= 8) {
    return null;
  }
  return `${trimmed.slice(0, 3)}…${trimmed.slice(-4)}`;
}

function touch(connection: AiConnection, changes: Partial<AiConnection>): AiConnection {
  return { ...connection, ...changes, updatedAt: new Date().toISOString() };
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>, userId: string | undefined) {
  if (userId) {
    void queryClient.invalidateQueries({ queryKey: aiConnectionKeys.list(userId) });
    void queryClient.invalidateQueries({ queryKey: aiSettingsKeys.detail(userId) });
  }
}

/** 当前用户的全部生成连接（浏览器本地库，ADR 0043）。 */
export function useAiConnections() {
  const { session } = useSession();
  const userId = session?.user.id;

  return useQuery({
    queryKey: userId ? aiConnectionKeys.list(userId) : aiConnectionKeys.all,
    enabled: Boolean(userId),
    queryFn: () => readAiConnections(userId as string),
  });
}

/** 当前用户的 Ask 偏好（活跃连接 / 是否带入笔记）。 */
export function useAiSettings() {
  const { session } = useSession();
  const userId = session?.user.id;

  return useQuery({
    queryKey: userId ? aiSettingsKeys.detail(userId) : aiSettingsKeys.all,
    enabled: Boolean(userId),
    queryFn: () => readAiSettings(userId as string),
  });
}

/** 新建生成连接（key 只写入浏览器本地库）。 */
export function useCreateAiConnection() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: (input: {
      adapter: AiConnection['adapter'];
      name: string;
      credential: { apiKey: string };
    }): Promise<AiConnection> => {
      if (!userId) {
        throw new Error(NO_USER);
      }
      const now = new Date().toISOString();
      const connection: AiConnection = {
        id: crypto.randomUUID(),
        adapter: input.adapter,
        name: input.name,
        baseUrl: null,
        status: 'untested',
        credentialHint: credentialHint(input.credential.apiKey),
        apiKey: input.credential.apiKey.trim(),
        generationCapability: null,
        createdAt: now,
        updatedAt: now,
      };
      writeAiConnections(userId, [...readAiConnections(userId), connection]);
      return Promise.resolve(connection);
    },
    onSuccess: () => invalidate(queryClient, userId),
  });
}

/** 编辑连接名称 / 轮换密钥 / 启停状态；密钥或状态变更后回到未测试。 */
export function useUpdateAiConnection() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: (input: {
      connectionId: string;
      name?: string;
      credential?: { apiKey: string };
      enabled?: boolean;
    }): Promise<AiConnection> => {
      if (!userId) {
        throw new Error(NO_USER);
      }
      const connections = readAiConnections(userId);
      const current = connections.find((connection) => connection.id === input.connectionId);
      if (!current) {
        throw new Error(NO_USER);
      }
      const updated = touch(current, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.credential
          ? {
              apiKey: input.credential.apiKey.trim(),
              credentialHint: credentialHint(input.credential.apiKey),
              status: 'untested' as const,
              generationCapability: null,
            }
          : {}),
        ...(input.enabled !== undefined
          ? { status: input.enabled ? ('untested' as const) : ('disabled' as const) }
          : {}),
      });
      writeAiConnections(
        userId,
        connections.map((connection) =>
          connection.id === input.connectionId ? updated : connection,
        ),
      );
      return Promise.resolve(updated);
    },
    onSuccess: () => invalidate(queryClient, userId),
  });
}

/** 用选定模型探活连接；结论写回本地连接记录（状态 + 能力），服务端零存储。 */
export function useTestAiConnection() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: async (input: { connectionId: string; model: string }): Promise<AiConnection> => {
      if (!userId) {
        throw new Error(NO_USER);
      }
      const connections = readAiConnections(userId);
      const current = connections.find((connection) => connection.id === input.connectionId);
      if (!current) {
        throw new Error(NO_USER);
      }
      const outcome = await invokeAskTest(supabase, {
        provider: current.adapter,
        model: input.model,
        providerKey: current.apiKey,
      });
      const capability =
        outcome.status === 'passed'
          ? { ok: true, reason: null, model: input.model, testedAt: new Date().toISOString() }
          : {
              ok: false,
              reason: outcome.status === 'unavailable' ? 'network' : outcome.reason,
              model: input.model,
              testedAt: new Date().toISOString(),
            };
      const updated = touch(current, {
        status: capability.ok ? 'valid' : 'invalid',
        generationCapability: capability,
      });
      writeAiConnections(
        userId,
        connections.map((connection) =>
          connection.id === input.connectionId ? updated : connection,
        ),
      );
      return updated;
    },
    onSuccess: () => invalidate(queryClient, userId),
  });
}

/** 用连接的凭据检测模型列表；失败时 UI 保留手动输入路径。 */
export function useDiscoverAiConnectionModels() {
  const { session } = useSession();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: async (connectionId: string): Promise<string[]> => {
      if (!userId) {
        throw new Error(NO_USER);
      }
      const connection = readAiConnections(userId).find(
        (candidate) => candidate.id === connectionId,
      );
      if (!connection) {
        throw new Error(NO_USER);
      }
      const outcome = await invokeAskModels(supabase, {
        provider: connection.adapter,
        providerKey: connection.apiKey,
      });
      if (outcome.status !== 'success') {
        throw new Error('model_detection_unavailable');
      }
      return outcome.models;
    },
  });
}

/** 删除连接；若它正是活跃连接，同步清空 Ask 配置。 */
export function useDeleteAiConnection() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: (connection: AiConnection): Promise<void> => {
      if (!userId) {
        throw new Error(NO_USER);
      }
      writeAiConnections(
        userId,
        readAiConnections(userId).filter((candidate) => candidate.id !== connection.id),
      );
      const settings = readAiSettings(userId);
      if (settings.generationConnectionId === connection.id) {
        writeAiSettings(userId, { ...settings, generationConnectionId: null });
        clearAskByok(userId);
      }
      return Promise.resolve();
    },
    onSuccess: () => invalidate(queryClient, userId),
  });
}

/**
 * 更新 Ask 偏好。激活连接必须是已验证状态（旧受信函数规则的本地版），激活即把
 * provider / model / key 写入 ask-byok 配置供问答使用；取消活跃则清空 Ask 配置。
 * 调用方（连接管理器）负责在激活前完成 ADR 0042 的出网披露同意。
 */
export function useUpdateAiSettings() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: (input: {
      generationConnectionId?: string | null;
      includeNotesInAi?: boolean;
    }): Promise<AiSettings> => {
      if (!userId) {
        throw new Error(NO_USER);
      }
      const current = readAiSettings(userId);
      const next: AiSettings = { ...current, ...input };

      if (input.generationConnectionId !== undefined) {
        if (input.generationConnectionId === null) {
          clearAskByok(userId);
        } else {
          const connection = readAiConnections(userId).find(
            (candidate) => candidate.id === input.generationConnectionId,
          );
          // 活跃连接必须已通过探针（旧受信函数规则 `connection_not_valid` 的本地版）。
          const model = readTestedModel(connection?.generationCapability);
          if (connection?.status !== 'valid' || !model) {
            throw new Error('connection_not_valid');
          }
          saveAskByok(userId, {
            provider: connection.adapter,
            model,
            providerKey: connection.apiKey,
          });
        }
      }

      writeAiSettings(userId, next);
      return Promise.resolve(next);
    },
    onSuccess: () => invalidate(queryClient, userId),
  });
}
