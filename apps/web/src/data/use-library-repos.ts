import { listLibraryRepos } from '@asterism/db';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '../auth/use-session';
import { supabase } from '../lib/supabase';
import { repoKeys } from './keys';

export function useLibraryRepos() {
  const { session } = useSession();
  const userId = session?.user.id;

  return useQuery({
    queryKey: userId ? repoKeys.library(userId) : repoKeys.all,
    enabled: Boolean(userId),
    queryFn: () => listLibraryRepos(supabase, userId as string),
  });
}
