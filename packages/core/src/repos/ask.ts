/**
 * Ask Asterism 领域逻辑入口（GitHub #41，ADR 0042）：
 * 个人库 Grounding 问答的召回、prompt 组装与响应校验，全部为纯函数。
 * 防幻觉由结构保证——模型只能以候选索引作答，界面只渲染通过校验的本地数据；
 * 召回为空时不发起生成，由调用方直接呈现固定的「未找到」文案。
 *
 * 三个阶段各自成文件，本文件只保留连接能力读取并汇总导出。
 * 回答契约为 Markdown 正文 + 末尾推荐哨兵（ADR 0044）；引用校验仍在客户端。
 */

export {
  ASK_CANDIDATE_LIMIT,
  type AskCandidate,
  type SelectAskCandidatesInput,
  selectAskCandidates,
  tokenizeQuestion,
} from './ask-candidates';
export {
  ASK_MAX_RECOMMENDATIONS,
  type AskAnswer,
  type AskParseResult,
  type AskRecommendation,
  parseAskResponse,
} from './ask-parse';
export {
  type AskExchange,
  type AskPrompt,
  type BuildAskPromptInput,
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
  createAskSseDecoder,
  createOpenAiDeltaDecoder,
  encodeAskSseEvent,
} from './ask-sse';
export {
  ASK_RECOMMENDATIONS_FENCE,
  type AskStreamSplit,
  splitAskStream,
} from './ask-stream';

// ---------------------------------------------------------------------------
// 连接能力读取（ADR 0043；自旧 Generation Registry 的 capability 读取原样迁移）
// ---------------------------------------------------------------------------

/** 一次连接探针的结论投影；`reason` 沿用旧探针词汇供界面映射失败原因。 */
export interface GenerationCapabilityView {
  ok: boolean;
  model: string | null;
  testedAt: string | null;
  reason: string | null;
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
  return {
    ok: record.ok,
    model: model.length > 0 ? model : null,
    testedAt: typeof record.testedAt === 'string' ? record.testedAt : null,
    reason: typeof record.reason === 'string' ? record.reason : null,
  };
}

/** 连接通过能力测试时证明过的唯一模型；未测试或失败返回 null。 */
export function readTestedModel(capability: unknown): string | null {
  const parsed = readGenerationCapability(capability);
  return parsed?.ok ? parsed.model : null;
}
