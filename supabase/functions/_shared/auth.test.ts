import { describe, expect, it, vi } from 'vitest';
import { extractBearerToken, verifyBearerPrincipal } from './auth';
import { resolveCorsHeaders } from './cors';

describe('edge _shared auth & cors', () => {
  it('extracts bearer tokens case-insensitively', () => {
    const req = new Request('https://example.test/mcp', {
      headers: { Authorization: 'bearer  abc.def.ghi  ' },
    });
    expect(extractBearerToken(req)).toBe('abc.def.ghi');
    expect(extractBearerToken(new Request('https://example.test/mcp'))).toBeNull();
    expect(
      extractBearerToken(
        new Request('https://example.test/mcp', { headers: { Authorization: 'Basic xyz' } }),
      ),
    ).toBeNull();
  });

  it('verifies bearer principal via verifier and parses JWT claims metadata', async () => {
    const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({ sub: 'user-1', scope: 'openid email', exp: 1900000000 }));
    const jwt = `${header}.${payload}.sig`;
    const getUser = vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });

    const principal = await verifyBearerPrincipal({ getUser }, jwt);
    expect(principal).toEqual({
      userId: 'user-1',
      jwt,
      scopes: ['openid', 'email'],
      expiresAt: 1900000000,
    });

    const invalid = await verifyBearerPrincipal(
      { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('revoked') }) },
      jwt,
    );
    expect(invalid).toBeNull();
  });

  it('resolves CORS headers with wildcard default or origin allowlist', () => {
    const open = resolveCorsHeaders(
      new Request('https://example.test/mcp', { headers: { Origin: 'https://any.app' } }),
    );
    expect(open['Access-Control-Allow-Origin']).toBe('*');

    const restricted = resolveCorsHeaders(
      new Request('https://example.test/mcp', { headers: { Origin: 'https://evil.app' } }),
      { allowedOrigins: ['https://asterism.app'], exposeHeaders: 'WWW-Authenticate' },
    );
    expect(restricted['Access-Control-Allow-Origin']).toBe('https://asterism.app');
    expect(restricted['Access-Control-Expose-Headers']).toBe('WWW-Authenticate');
  });
});
