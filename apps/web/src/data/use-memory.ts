import { getMemory, saveMemory } from '@asterism/db';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../auth/use-session';
import { updateNoteRepoIds } from '../lib/repo-card-metadata';
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
      queryClient.setQueryData<string[] | undefined>(memoryKeys.noteRepoIds(userId), (current) =>
        updateNoteRepoIds(current, memory.repoId, Boolean(memory.note?.trim())),
      );
      queryClient.setQueryData(memoryKeys.detail(userId, memory.repoId), memory);
      void queryClient.invalidateQueries({ queryKey: memoryKeys.noteRepoIds(userId) });
      void queryClient.invalidateQueries({ queryKey: memoryKeys.list(userId) });
    },
  });
}
