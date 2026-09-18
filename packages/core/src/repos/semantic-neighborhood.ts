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

function cosineSimilarity(
  left: readonly number[],
  right: readonly number[],
  leftNorm: number,
  rightNorm: number,
): number {
  if (left.length !== right.length || leftNorm === 0 || rightNorm === 0) {
    return Number.NEGATIVE_INFINITY;
  }
  let dot = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += (left[index] ?? 0) * (right[index] ?? 0);
  }
  return dot / (leftNorm * rightNorm);
}

function vectorNorm(vector: readonly number[]): number {
  let squared = 0;
  for (const value of vector) {
    squared += value * value;
  }
  return Math.sqrt(squared);
}

function compareNeighbors(left: SemanticNeighbor, right: SemanticNeighbor): number {
  return right.similarity - left.similarity || left.repoId.localeCompare(right.repoId);
}

/**
 * Returns a conservative local semantic neighborhood.
 *
 * A candidate is accepted only when both repositories appear in each other's
 * nearest-neighbor pool. The relationship may legitimately be empty.
 * Memory participates through the vectors themselves; no extra bonus is applied merely
 * because a repository has a non-empty Memory.
 */
export function findMutualSemanticNeighbors(
  vectors: readonly RepoSemanticVector[],
  anchorRepoId: string,
): SemanticNeighbor[] {
  const uniqueVectors = new Map<string, readonly number[]>();
  for (const item of vectors) {
    if (!uniqueVectors.has(item.repoId) && item.embedding.length > 0) {
      uniqueVectors.set(item.repoId, item.embedding);
    }
  }
  const anchor = uniqueVectors.get(anchorRepoId);
  if (!anchor) {
    return [];
  }

  const norms = new Map<string, number>();
  for (const [repoId, vector] of uniqueVectors) {
    norms.set(repoId, vectorNorm(vector));
  }

  const nearestFor = (repoId: string): SemanticNeighbor[] => {
    const source = uniqueVectors.get(repoId);
    const sourceNorm = norms.get(repoId) ?? 0;
    if (!source || sourceNorm === 0) {
      return [];
    }
    const nearest: SemanticNeighbor[] = [];

    for (const [candidateId, candidate] of uniqueVectors) {
      if (candidateId === repoId) {
        continue;
      }
      const similarity = cosineSimilarity(
        source,
        candidate,
        sourceNorm,
        norms.get(candidateId) ?? 0,
      );
      if (Number.isFinite(similarity)) {
        nearest.push({ repoId: candidateId, similarity });
      }
    }
    nearest.sort(compareNeighbors);
    return nearest.slice(0, CANDIDATE_POOL_SIZE);
  };

  const candidates = nearestFor(anchorRepoId);
  const mutual: SemanticNeighbor[] = [];
  for (const candidate of candidates) {
    if (nearestFor(candidate.repoId).some((item) => item.repoId === anchorRepoId)) {
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
