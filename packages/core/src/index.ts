export { normalizeClassificationName } from './classifications/name';
export {
  buildExportPayload,
  scopeExportSnapshot,
  serializeExportCsv,
  serializeExportJson,
  serializeExportMarkdown,
} from './data-port/export';
export { normalizeImportData, parseImportJson } from './data-port/import';
export type {
  ExportCollection,
  ExportCollectionRepo,
  ExportMemory,
  ExportPayload,
  ExportPayloadV3,
  ExportRepo,
  ExportSnapshot,
  ImportPayload,
  NormalizedImportData,
  ParsedImportPayload,
} from './data-port/types';
export { EXPORT_VERSION } from './data-port/types';
export type {
  DesiredRepoEmbedding,
  EmbeddableRepo,
  EmbeddingBackfillProgress,
  EmbeddingBackfillTarget,
  EmbeddingStalenessReason,
  RepoEmbeddingBackfillItem,
  StoredRepoEmbedding,
} from './embeddings/embeddings';
export {
  computeContentHash,
  DEFAULT_EMBEDDING_DIMENSIONS,
  DEFAULT_EMBEDDING_MODEL,
  E5_PASSAGE_PREFIX,
  E5_QUERY_PREFIX,
  EMBEDDING_BACKFILL_BATCH_SIZE,
  embeddableRepoText,
  repoContentHash,
  runEmbeddingBackfill,
  selectReposToEmbed,
  toPassageInput,
  toQueryInput,
} from './embeddings/embeddings';
export type {
  CollectStarredOptions,
  FetchStarredPage,
  RawStarEdge,
  StarredPage,
  StarredRepo,
} from './github/stars';
export {
  collectStarredRepos,
  createGitHubStarsFetcher,
  GitHubSyncError,
  mapStarEdgeToRepo,
  STARRED_REPOS_QUERY,
} from './github/stars';
export type { Collection, CollectionId } from './models/collection';
export type { Memory, MemorySource } from './models/memory';
export type { Repo, RepoId } from './models/repo';
export { repoFullName } from './models/repo';
export type {
  ArchiveSplit,
  CollectionUsage,
  DashboardInsights,
  DashboardStats,
  DeriveDashboardInput,
  NamedCount,
  RepoCollectionLink,
  YearCount,
} from './repos/analytics';
export { deriveDashboardInsights } from './repos/analytics';
export type {
  AskAnswer,
  AskCandidate,
  AskExchange,
  AskParseResult,
  AskPrompt,
  AskProviderDefinition,
  AskProviderId,
  AskRecommendation,
  BuildAskPromptInput,
  GenerationCapabilityView,
  SelectAskCandidatesInput,
} from './repos/ask';
export {
  ASK_CANDIDATE_LIMIT,
  ASK_MAX_RECOMMENDATIONS,
  ASK_PROVIDERS,
  buildAskPrompt,
  findAskProvider,
  parseAskResponse,
  readGenerationCapability,
  readTestedModel,
  selectAskCandidates,
  tokenizeQuestion,
} from './repos/ask';
export type {
  RepoFacets,
  RepoFilter,
  RepoSort,
  RepoStatus,
  StarredRepoLike,
} from './repos/filter';
export {
  deriveRepoFacets,
  filterStarredRepos,
  hasActiveFilter,
  sortStarredRepos,
} from './repos/filter';
export type { HybridRankInput, HybridRankResult } from './repos/hybrid-search';
export { rankHybridRepos } from './repos/hybrid-search';
export type {
  DeriveResurfaceInput,
  ResurfaceCandidate,
  ResurfaceReason,
  ResurfaceStreamKind,
  ResurfaceStreams,
} from './repos/resurface';
export { deriveResurfaceStreams } from './repos/resurface';
export type {
  MatchExplanation,
  MatchReason,
  MatchReasonKind,
  RetrieveInput,
  RetrieveResult,
} from './repos/retrieval';
export { extractSnippet, retrieveRepos } from './repos/retrieval';
export type {
  FallbackNeighbor,
  KeywordFallbackNeighborInput,
  RepoSemanticVector,
  SemanticNeighbor,
  SemanticNeighborhoodIndex,
} from './repos/semantic-neighborhood';
export {
  buildSemanticNeighborhoodIndex,
  findKeywordFallbackNeighbors,
  findMutualSemanticNeighbors,
} from './repos/semantic-neighborhood';
