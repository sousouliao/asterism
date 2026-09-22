const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class GitHubRefreshError extends Error {
  constructor(readonly requiresReconnect: boolean) {
    super(requiresReconnect ? 'GitHub connection expired' : 'GitHub token refresh failed');
  }
}

function keyBytes(): ArrayBuffer {
  const encoded = Deno.env.get('GITHUB_SYNC_ENCRYPTION_KEY');
  if (!encoded) throw new Error('GitHub sync encryption key is not configured');
  const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
  if (bytes.length !== 32) throw new Error('GitHub sync encryption key must be 32 bytes');
  const buffer = new ArrayBuffer(32);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function key(): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', keyBytes(), 'AES-GCM', false, ['encrypt', 'decrypt']);
}

function encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

export async function encryptCredential(value: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(), encoder.encode(value)),
  );
  return `v1:${encode(iv)}:${encode(encrypted)}`;
}

export async function decryptCredential(value: string): Promise<string> {
  const [version, ivEncoded, encryptedEncoded] = value.split(':');
  if (version !== 'v1' || !ivEncoded || !encryptedEncoded) {
    throw new Error('Unsupported GitHub credential format');
  }
  const iv = Uint8Array.from(atob(ivEncoded), (char) => char.charCodeAt(0));
  const encrypted = Uint8Array.from(atob(encryptedEncoded), (char) => char.charCodeAt(0));
  return decoder.decode(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await key(), encrypted),
  );
}

export async function refreshGitHubToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const clientId = Deno.env.get('GITHUB_CLIENT_ID');
  const clientSecret = Deno.env.get('GITHUB_CLIENT_SECRET');
  if (!clientId || !clientSecret) throw new GitHubRefreshError(false);
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  if (!response.ok) throw new GitHubRefreshError(response.status >= 400 && response.status < 500);
  const result = (await response.json()) as Record<string, unknown>;
  if (typeof result.access_token !== 'string' || typeof result.refresh_token !== 'string') {
    throw new GitHubRefreshError(typeof result.error === 'string');
  }
  return { accessToken: result.access_token, refreshToken: result.refresh_token };
}
