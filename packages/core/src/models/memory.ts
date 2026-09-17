import type { RepoId } from './repo';

export type MemorySource = 'github_star';

/** 当前用户与仓库之间的一等私人关系。 */
export interface Memory {
  repoId: RepoId;
  source: MemorySource;
  sourceCreatedAt: string | null;
  whySaved: string | null;
  note: string | null;
}
