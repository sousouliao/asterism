export interface CorsOptions {
  allowedOrigins?: readonly string[];
  methods?: string;
  allowHeaders?: string;
  exposeHeaders?: string;
}

const DEFAULT_ALLOW_HEADERS = 'authorization, x-client-info, apikey, content-type';

export function resolveCorsHeaders(
  request: Request,
  options: CorsOptions = {},
): Record<string, string> {
  const methods = options.methods ?? 'POST, OPTIONS';
  const allowHeaders = options.allowHeaders ?? DEFAULT_ALLOW_HEADERS;
  const base: Record<string, string> = {
    'Access-Control-Allow-Headers': allowHeaders,
    'Access-Control-Allow-Methods': methods,
    ...(options.exposeHeaders ? { 'Access-Control-Expose-Headers': options.exposeHeaders } : {}),
  };

  const allowedOrigins = options.allowedOrigins;
  const [fallback] = allowedOrigins ?? [];
  if (fallback === undefined) {
    return { ...base, 'Access-Control-Allow-Origin': '*' };
  }

  const origin = request.headers.get('Origin');
  const allowed = origin !== null && allowedOrigins?.includes(origin) === true;
  return {
    ...base,
    // 不匹配时回显首个允许来源：浏览器据此拒绝该响应，且不泄漏允许列表全貌。
    'Access-Control-Allow-Origin': allowed ? origin : fallback,
    Vary: 'Origin',
  };
}

export function createJsonResponder<T = unknown>(corsHeaders: Record<string, string>) {
  return (body: T, status = 200, extraHeaders?: Record<string, string>): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
    });
}
