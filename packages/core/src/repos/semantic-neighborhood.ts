import type { Memory } from '../models/memory';
import type { Repo } from '../models/repo';

export interface RepoSemanticVector {
  repoId: string;
  embedding: readonly number[];
}

export interface SemanticNeighbor {
  repoId: string;
  similarity: number;
}

export interface FallbackNeighbor {
  repoId: string;
  score: number;
  matchedReason: 'topic' | 'memory';
}

export interface KeywordFallbackNeighborInput {
  anchorRepoId: string;
  anchorRepo: Repo;
  items: readonly { repoId: string; repo: Repo }[];
  memoriesByRepoId?: Map<string, Memory>;
  limit?: number;
}

const CANDIDATE_POOL_SIZE = 12;
const RESULT_LIMIT = 5;

function compareNeighbors(left: SemanticNeighbor, right: SemanticNeighbor): number {
  return right.similarity - left.similarity || left.repoId.localeCompare(right.repoId);
}

/**
 * 预归一化的向量索引：把 L2 归一化和 Top-K 池摊到一次构建上，
 * 让同一批向量下的多个锚点查询只付一次全量扫描的代价。
 */
export interface SemanticNeighborhoodIndex {
  readonly size: number;
  has(repoId: string): boolean;
  nearestPool(repoId: string): readonly SemanticNeighbor[];
}

/** 归一化后余弦相似度退化为点积；维度不同的向量之间不具可比性。 */
function dot(left: Float64Array, right: Float64Array): number {
  if (left.length !== right.length) {
    return Number.NEGATIVE_INFINITY;
  }
  let sum = 0;
  for (let index = 0; index < left.length; index += 1) {
    sum += (left[index] as number) * (right[index] as number);
  }
  return sum;
}

/** 维护一个长度上限为 CANDIDATE_POOL_SIZE 的有序池，避免对全量候选排序。 */
function pushBounded(pool: SemanticNeighbor[], candidate: SemanticNeighbor): void {
  const full = pool.length === CANDIDATE_POOL_SIZE;
  if (full && compareNeighbors(candidate, pool[pool.length - 1] as SemanticNeighbor) >= 0) {
    return;
  }
  let insertAt = pool.length;
  while (insertAt > 0 && compareNeighbors(candidate, pool[insertAt - 1] as SemanticNeighbor) < 0) {
    insertAt -= 1;
  }
  pool.splice(insertAt, 0, candidate);
  if (pool.length > CANDIDATE_POOL_SIZE) {
    pool.pop();
  }
}

export function buildSemanticNeighborhoodIndex(
  vectors: readonly RepoSemanticVector[],
): SemanticNeighborhoodIndex {
  const repoIds: string[] = [];
  const unitVectors: Float64Array[] = [];
  const positionByRepoId = new Map<string, number>();

  for (const item of vectors) {
    if (item.embedding.length === 0 || positionByRepoId.has(item.repoId)) {
      continue;
    }
    let squared = 0;
    for (const value of item.embedding) {
      squared += value * value;
    }
    const norm = Math.sqrt(squared);
    if (norm === 0) {
      // 零向量与任何向量都不可比，索引阶段直接剔除。
      continue;
    }
    const unit = new Float64Array(item.embedding.length);
    for (let index = 0; index < item.embedding.length; index += 1) {
      unit[index] = (item.embedding[index] as number) / norm;
    }
    positionByRepoId.set(item.repoId, repoIds.length);
    repoIds.push(item.repoId);
    unitVectors.push(unit);
  }

  const poolCache = new Map<string, readonly SemanticNeighbor[]>();

  const nearestPool = (repoId: string): readonly SemanticNeighbor[] => {
    const cached = poolCache.get(repoId);
    if (cached) {
      return cached;
    }
    const position = positionByRepoId.get(repoId);
    if (position === undefined) {
      poolCache.set(repoId, []);
      return [];
    }
    const source = unitVectors[position] as Float64Array;
    const pool: SemanticNeighbor[] = [];
    for (let index = 0; index < repoIds.length; index += 1) {
      if (index === position) {
        continue;
      }
      const similarity = dot(source, unitVectors[index] as Float64Array);
      if (Number.isFinite(similarity)) {
        pushBounded(pool, { repoId: repoIds[index] as string, similarity });
      }
    }
    poolCache.set(repoId, pool);
    return pool;
  };

  return {
    size: repoIds.length,
    has: (repoId) => positionByRepoId.has(repoId),
    nearestPool,
  };
}

/**
 * Returns a conservative local semantic neighborhood.
 *
 * A candidate is accepted only when both repositories appear in each other's
 * nearest-neighbor pool. The relationship may legitimately be empty.
 * Memory participates through the vectors themselves; no extra bonus is applied merely
 * because a repository has a non-empty Memory.
 *
 * 传入索引可以在多个锚点之间复用扫描结果；传入原始向量则按单次查询处理。
 */
export function findMutualSemanticNeighbors(
  source: readonly RepoSemanticVector[] | SemanticNeighborhoodIndex,
  anchorRepoId: string,
): SemanticNeighbor[] {
  const index = Array.isArray(source)
    ? buildSemanticNeighborhoodIndex(source)
    : (source as SemanticNeighborhoodIndex);
  if (!index.has(anchorRepoId)) {
    return [];
  }

  const mutual: SemanticNeighbor[] = [];
  for (const candidate of index.nearestPool(anchorRepoId)) {
    if (index.nearestPool(candidate.repoId).some((item) => item.repoId === anchorRepoId)) {
      mutual.push(candidate);
      if (mutual.length === RESULT_LIMIT) {
        break;
      }
    }
  }
  return mutual;
}

function extractMemoryKeywords(text: string): string[] {
  const words = text.split(/[\s,，、。！？；;:：/\\|()[\]{}<>"'`~]+/);
  const keywords = new Set<string>();
  for (const word of words) {
    const trimmed = word.trim();
    if (trimmed.length >= 2) {
      keywords.add(trimmed);
      // 中文字符串生成 2-gram 辅助意图重叠匹配
      if (/[\u4e00-\u9fa5]/.test(trimmed) && trimmed.length > 2) {
        for (let i = 0; i <= trimmed.length - 2; i += 1) {
          keywords.add(trimmed.slice(i, i + 2));
        }
      }
    }
  }
  return Array.from(keywords);
}

/**
 * 降级相关推荐算法（Fallback Neighbors）：
 * 当语义向量模型未就绪、无向量数据或在弱设备上时，
 * 综合利用 Topics 重叠、同编程语言、以及 Memory 意图关键词交集，
 * 计算出轻量级相关推荐。
 */
export function findKeywordFallbackNeighbors({
  anchorRepoId,
  anchorRepo,
  items,
  memoriesByRepoId,
  limit = RESULT_LIMIT,
}: KeywordFallbackNeighborInput): FallbackNeighbor[] {
  const anchorTopics = new Set(anchorRepo.topics.map((t) => t.toLowerCase().trim()));
  const anchorLang = anchorRepo.language?.toLowerCase().trim();
  const anchorMemory = memoriesByRepoId?.get(anchorRepoId);
  const anchorMemoryText = [anchorMemory?.whySaved, anchorMemory?.note]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const anchorKeywords = anchorMemoryText ? extractMemoryKeywords(anchorMemoryText) : [];

  const candidates: FallbackNeighbor[] = [];

  for (const item of items) {
    if (item.repoId === anchorRepoId) {
      continue;
    }
    const repo = item.repo;
    let score = 0;
    let topicScore = 0;
    let memoryScore = 0;

    // 1. Topic 重叠：每个交集记 2.0 分
    let topicOverlapCount = 0;
    for (const topic of repo.topics) {
      if (anchorTopics.has(topic.toLowerCase().trim())) {
        topicOverlapCount += 1;
      }
    }
    if (topicOverlapCount > 0) {
      topicScore = topicOverlapCount * 2.0;
      score += topicScore;
    }

    // 2. 编程语言相同：记 1.0 分
    if (anchorLang && repo.language?.toLowerCase().trim() === anchorLang) {
      score += 1.0;
    }

    // 3. Memory 意图词重叠匹配
    if (anchorKeywords.length > 0) {
      const candidateMemory = memoriesByRepoId?.get(item.repoId);
      const candidateMemoryText = [candidateMemory?.whySaved, candidateMemory?.note]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (candidateMemoryText) {
        const hasOverlap = anchorKeywords.some((keyword) => candidateMemoryText.includes(keyword));
        if (hasOverlap) {
          memoryScore = 2.5;
          score += memoryScore;
        }
      }
    }

    // 相同语言只能作为排序加成，不能单独构成可信的 Related Stars 关系。
    if (topicScore > 0 || memoryScore > 0) {
      candidates.push({
        repoId: item.repoId,
        score,
        matchedReason: memoryScore > topicScore ? 'memory' : 'topic',
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score || a.repoId.localeCompare(b.repoId));
  return candidates.slice(0, limit);
}
