import { describe, expect, it } from 'vitest';
import { buildLoginPath, buildOAuthRedirectUrl, sanitizeNextPath } from './redirect';

describe('auth redirect helpers', () => {
  it('accepts safe relative paths and rejects open redirects or login loops', () => {
    expect(sanitizeNextPath('/oauth/consent?authorization_id=abc-123')).toBe(
      '/oauth/consent?authorization_id=abc-123',
    );
    expect(sanitizeNextPath('/collections/abc')).toBe('/collections/abc');
    expect(sanitizeNextPath('https://evil.example/phish')).toBeNull();
    expect(sanitizeNextPath('//evil.example/phish')).toBeNull();
    expect(sanitizeNextPath('/\\evil.example')).toBeNull();
    expect(sanitizeNextPath('/login?next=/')).toBeNull();
    expect(sanitizeNextPath('')).toBeNull();
  });

  it('builds login redirect preserving deep links except root', () => {
    expect(buildLoginPath('/', '')).toBe('/login');
    expect(buildLoginPath('/oauth/consent', '?authorization_id=123')).toBe(
      '/login?next=%2Foauth%2Fconsent%3Fauthorization_id%3D123',
    );
  });

  it('builds OAuth callback URL preserving safe next path', () => {
    expect(
      buildOAuthRedirectUrl('https://asterism.app/', '/oauth/consent?authorization_id=1'),
    ).toBe('https://asterism.app/oauth/consent?authorization_id=1');
    expect(buildOAuthRedirectUrl('https://asterism.app', 'https://evil.example')).toBe(
      'https://asterism.app',
    );
  });
});
