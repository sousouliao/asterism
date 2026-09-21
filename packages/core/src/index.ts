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
  AskCatalog,
  AskCatalogTier,
  AskExchange,
  AskLoopState,
  AskLoopStopReason,
  AskParseResult,
  AskPrompt,
  AskProviderDefinition,
  AskProviderId,
  AskRecommendation,
  AskSseErrorStatus,
  AskSseEvent,
  AskStreamSplit,
  AskToolCall,
  AskToolContext,
  AskToolExpanded,
  AskToolFilterResult,
  AskToolHit,
  AskToolName,
  BuildAskPromptInput,
  GenerationCapabilityView,
  OpenAiStreamPart,
} from './repos/ask';
export {
  ASK_CATALOG_COMPACT_MAX,
  ASK_CATALOG_FULL_MAX,
  ASK_EXPAND_MAX_IDS,
  ASK_FILTER_PAGE_SIZE,
  ASK_LOOP_HARD_ROUNDS,
  ASK_LOOP_SOFT_ROUNDS,
  ASK_MAX_RECOMMENDATIONS,
  ASK_PROVIDERS,
  ASK_RECOMMENDATIONS_FENCE,
  ASK_SEARCH_DEFAULT_LIMIT,
  ASK_SSE_ERROR_STATUSES,
  ASK_TOOL_DEFINITIONS,
  applyAskReadGate,
  buildAskCatalog,
  buildAskPrompt,
  canContinueAskLoop,
  classifyAskCatalogTier,
  createAskLoopState,
  createAskSseDecoder,
  createOpenAiDeltaDecoder,
  createOpenAiStreamDecoder,
  createOpenAiToolCallAssembler,
  encodeAskSseEvent,
  executeAskTool,
  expandAskRepos,
  filterAskRepos,
  findAskProvider,
  isAskBudgetStop,
  isAskToolName,
  noteAskToolRound,
  parseAskResponse,
  readGenerationCapability,
  readTestedModel,
  searchAskRepos,
  splitAskStream,
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
