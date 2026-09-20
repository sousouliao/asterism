import type { Memory } from '@asterism/core';
import { getMemory, saveMemory } from '@asterism/db';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../auth/use-session';
import { supabase } from '../lib/supabase';
import { memoryKeys } from './keys';

const NO_USER = 'NO_USER';

export function useMemory(repoId: string | null) {
  const { session } = useSession();
  const userId = session?.user.id;

  return useQuery({
    queryKey: memoryKeys.detail(userId ?? 'anon', repoId ?? 'none'),
    enabled: Boolean(userId && repoId),
    queryFn: () => getMemory(supabase, { userId: userId as string, repoId: repoId as string }),
  });
}

export function useSaveMemory() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: (input: { repoId: string; whySaved: string; note: string }) => {
      if (!userId) {
        throw new Error(NO_USER);
      }
      return saveMemory(supabase, { userId, ...input });
    },
    onSuccess: (memory) => {
      if (!userId) {
        return;
      }
      queryClient.setQueryData(memoryKeys.detail(userId, memory.repoId), memory);
      // Memory 列表是 Browse 检索上下文与 Note 标记的唯一来源：就地合并保存结果
      // 让界面立刻反映，再由重新拉取收敛到权威数据。
      queryClient.setQueryData<Memory[] | undefined>(memoryKeys.list(userId), (current) =>
        current
          ? current.some((item) => item.repoId === memory.repoId)
            ? current.map((item) => (item.repoId === memory.repoId ? memory : item))
            : [...current, memory]
          : current,
      );
      void queryClient.invalidateQueries({ queryKey: memoryKeys.list(userId) });
    },
  });
}
