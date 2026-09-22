import { FunctionsHttpError } from '@supabase/supabase-js';
import type { SupabaseClient } from './client';

export interface SyncStarsResult {
  /** GitHub 拉取到并处理的 star 总数（本次同步范围内）。 */
  total: number;
  /** upsert 进 repos 的行数。 */
  upserted: number;
  /** 关联进当前用户 user_stars 的行数。 */
  starsLinked: number;
  /** 本次完整对账发现取消 Star 的仓库数。 */
  unstarred: number;
}

export class SyncStarsError extends Error {
  /** Edge Function 返回的 HTTP 状态码（若可得），便于区分「未部署/鉴权失败/上游报错」。 */
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'SyncStarsError';
    this.status = status;
  }
}

/**
 * supabase-js 对非 2xx 的 `functions.invoke` 只给出通用 message，真实原因在 `error.context`
 * （Response 体）里。这里把它读出来，避免上层只能看到「Edge Function returned a non-2xx」。
 */
async function describeInvokeError(error: unknown): Promise<{ message: string; status?: number }> {
  if (error instanceof FunctionsHttpError) {
    const status = error.context?.status;
    let detail = '';
    try {
      const body: unknown = await error.context.clone().json();
      if (body && typeof body === 'object') {
        const record = body as Record<string, unknown>;
        if (typeof record.error === 'string') {
          detail = record.error;
        } else if (typeof record.message === 'string') {
          detail = record.message;
        }
      }
    } catch {
      // 响应体不是 JSON（如网关 404 文本），退回到状态码描述。
    }
    if (!detail) {
      detail =
        status === 404
          ? 'sync-stars Edge Function is not deployed (404)'
          : `sync-stars failed with HTTP ${status ?? 'unknown'}`;
    }
    return { message: detail, status };
  }
  if (error instanceof Error) {
    return { message: error.message };
  }
  return { message: String(error) };
}

/**
 * 触发 Edge Function `sync-stars` 完成 stars 同步（受信路径写入，见 decisions/0006）。
 * 客户端有 GitHub provider token 时交给函数保存；之后函数可复用受信存储的连接。
 */
export async function invokeSyncStars(
  client: SupabaseClient,
  providerToken?: string,
  providerRefreshToken?: string,
): Promise<SyncStarsResult> {
  const { data, error } = await client.functions.invoke<SyncStarsResult>('sync-stars', {
    body: { providerToken, providerRefreshToken },
  });

  if (error) {
    const { message, status } = await describeInvokeError(error);
    throw new SyncStarsError(message, status);
  }
  if (!data) {
    throw new SyncStarsError('sync-stars returned no data');
  }
  return data;
}
