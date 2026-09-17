import { listMemories } from '@asterism/db';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '../auth/use-session';
import { supabase } from '../lib/supabase';
import { memoryKeys } from './keys';

export function useMemoriesList(options?: { enabled?: boolean }) {
  const { session } = useSession();
  const userId = session?.user.id;

  return useQuery({
    queryKey: userId ? memoryKeys.list(userId) : memoryKeys.all,
    enabled: Boolean(userId) && (options?.enabled ?? true),
    queryFn: () => listMemories(supabase, userId as string),
  });
}
