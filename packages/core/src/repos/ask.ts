/**
 * Ask Asterism 领域逻辑入口（GitHub #41，ADR 0042 / 0045）：
 * 目录常驻浅层 Agent 的 catalog / tools / loop / prompt / 引用校验，全部为纯函数。
 * 防幻觉由结构保证——模型只能推荐本轮已 expand 的 repoId，界面只渲染通过校验的本地数据。
 * 能力不足的模型降级到固定 top-K 召回（ADR 0042）。
 */

export {
  ASK_CANDIDATE_LIMIT,
  type AskCandidate,
  type SelectAskCandidatesInput,
  selectAskCandidates,
  tokenizeQuestion,
} from './ask-candidates';
export {
  ASK_CATALOG_COMPACT_MAX,
  ASK_CATALOG_DESCRIPTION_CHARS,
  ASK_CATALOG_FULL_MAX,
  type AskCatalog,
  type AskCatalogTier,
  type BuildAskCatalogInput,
  buildAskCatalog,
  classifyAskCatalogTier,
  estimateAskTokens,
} from './ask-catalog';
export {
  ASK_LOOP_HARD_ROUNDS,
  ASK_LOOP_RESULT_CHAR_BUDGET,
  ASK_LOOP_SOFT_ROUNDS,
  type AskLoopState,
  type AskLoopStopReason,
  applyAskReadGate,
  canContinueAskLoop,
  createAskLoopState,
  isAskBudgetStop,
  noteAskToolRound,
} from './ask-loop';
export {
  ASK_MAX_RECOMMENDATIONS,
  type AskAnswer,
  type AskParseResult,
  type AskRecommendation,
  parseAskFixedResponse,
  parseAskResponse,
} from './ask-parse';
export {
  type AskExchange,
  type AskPrompt,
  type BuildAskFixedPromptInput,
  type BuildAskPromptInput,
  buildAskFixedPrompt,
  buildAskPrompt,
} from './ask-prompt';
// Provider 白名单是 Edge Function 与客户端共用的单一真相源，见 ./ask-providers。
export {
  ASK_PROVIDERS,
  type AskProviderDefinition,
  type AskProviderId,
  findAskProvider,
  isAllowedAskProvider,
} from './ask-providers';
export {
  ASK_SSE_ERROR_STATUSES,
  type AskSseErrorStatus,
  type AskSseEvent,
  type AskToolCall,
  createAskSseDecoder,
  createOpenAiDeltaDecoder,
  createOpenAiStreamDecoder,
  createOpenAiToolCallAssembler,
  encodeAskSseEvent,
  type OpenAiStreamPart,
} from './ask-sse';
export {
  ASK_RECOMMENDATIONS_FENCE,
  type AskStreamSplit,
  splitAskStream,
} from './ask-stream';
export {
  ASK_EXPAND_MAX_IDS,
  ASK_FILTER_PAGE_SIZE,
  ASK_SEARCH_DEFAULT_LIMIT,
  ASK_TOOL_DEFINITIONS,
  type AskToolContext,
  type AskToolExpanded,
  type AskToolFilterInput,
  type AskToolFilterResult,
  type AskToolHit,
  type AskToolName,
  type AskToolSearchInput,
  executeAskTool,
  expandAskRepos,
  filterAskRepos,
  isAskToolName,
  searchAskRepos,
} from './ask-tools';

// ---------------------------------------------------------------------------
// 连接能力读取（ADR 0043 / 0045）
// ---------------------------------------------------------------------------

export type AskGenerationMode = 'agent' | 'fixed';

/** 一次连接探针的结论投影；`reason` 沿用旧探针词汇供界面映射失败原因。 */
export interface GenerationCapabilityView {
  ok: boolean;
  model: string | null;
  testedAt: string | null;
  reason: string | null;
  tools: boolean;
  longContext: boolean;
  mode: AskGenerationMode;
}

export function readGenerationCapability(capability: unknown): GenerationCapabilityView | null {
  if (capability === null || typeof capability !== 'object') {
    return null;
  }
  const record = capability as Record<string, unknown>;
  if (typeof record.ok !== 'boolean') {
    return null;
  }
  const model = typeof record.model === 'string' ? record.model.trim() : '';
  const tools = record.tools === true;
  const longContext = record.longContext === true;
  const storedMode = record.mode === 'agent' || record.mode === 'fixed' ? record.mode : null;
  return {
    ok: record.ok,
    model: model.length > 0 ? model : null,
    testedAt: typeof record.testedAt === 'string' ? record.testedAt : null,
    reason: typeof record.reason === 'string' ? record.reason : null,
    tools,
    longContext,
    mode: storedMode ?? (tools && longContext ? 'agent' : 'fixed'),
  };
}

/** 连接通过能力测试时证明过的唯一模型；未测试或失败返回 null。 */
export function readTestedModel(capability: unknown): string | null {
  const parsed = readGenerationCapability(capability);
  return parsed?.ok ? parsed.model : null;
}

/** Agent 循环仅在探针证明工具调用与长上下文都可用时启用；旧记录缺省走固定流程。 */
export function readAskGenerationMode(capability: unknown): AskGenerationMode {
  const parsed = readGenerationCapability(capability);
  if (!parsed?.ok) {
    return 'fixed';
  }
  return parsed.mode;
}
