import { listMemoryNoteRepoIds } from '@asterism/db';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '../auth/use-session';
import { supabase } from '../lib/supabase';
import { memoryKeys } from './keys';

export function useMemoryNoteRepoIds() {
  const { session } = useSession();
  const userId = session?.user.id;

  return useQuery({
    queryKey: userId ? memoryKeys.noteRepoIds(userId) : memoryKeys.all,
    enabled: Boolean(userId),
    queryFn: () => listMemoryNoteRepoIds(supabase, userId as string),
  });
}
