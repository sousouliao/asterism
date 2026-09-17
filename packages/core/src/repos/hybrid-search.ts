import type { Memory } from '../models/memory';
import type { RepoFilter, RepoSort, StarredRepoLike } from './filter';
import { retrieveRepos } from './retrieval';

/** 「隐形混合搜索」的输入：现有筛选/排序 + 可选的语义距离图 + 可选的 Memory 意图图。 */
export interface HybridRankInput<T extends StarredRepoLike> {
  items: T[];
  filter: RepoFilter;
  sort: RepoSort;
  now?: number;
  collectionsByRepoId?: Map<string, string[]>;
  memoriesByRepoId?: Map<string, Memory>;
  /** repoId → 语义距离（越小越近）；缺省 / 空表示不做语义扩展。 */
  distanceByRepoId?: ReadonlyMap<string, number>;
  /** 语义近邻最多补充多少条；缺省表示不限。 */
  semanticLimit?: number;
}

/** 单一结果画布拆成两段：关键词命中在上，语义近邻在下。 */
export interface HybridRankResult<T extends StarredRepoLike> {
  /** 关键词 + 筛选命中，按所选维度排序（等价于原有 Browse 列表）。 */
  primary: T[];
  /** 未命中关键词但语义相近的补充项，按距离升序（同距离按 fullName 稳定）。 */
  semantic: T[];
}

/**
 * 把关键词命中与语义近邻融合进同一排序，无模式开关（ADR 0026 §7）：
 * 统一委托至 retrieveRepos，保证零回归与平滑升级。
 */
export function rankHybridRepos<T extends StarredRepoLike>(
  input: HybridRankInput<T>,
): HybridRankResult<T> {
  const result = retrieveRepos(input);
  return { primary: result.primary, semantic: result.semantic };
}
