import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { GoogleOAuthProvider } from '../google-oauth.provider';

describe('GoogleOAuthProvider', () => {
  let provider: GoogleOAuthProvider;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    provider = new GoogleOAuthProvider();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('getAuthorizationUrl', () => {
    it('builds correct authorization URL', () => {
      const url = provider.getAuthorizationUrl('client-id', 'http://localhost/callback', 'random-state');

      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth?');
      expect(url).toContain('client_id=client-id');
      expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%2Fcallback');
      expect(url).toContain('response_type=code');
      expect(url).toContain('scope=openid+email+profile');
      expect(url).toContain('state=random-state');
      expect(url).toContain('access_type=offline');
      expect(url).toContain('prompt=consent');
    });

    it('uses custom scopes when provided', () => {
      const url = provider.getAuthorizationUrl('id', 'http://localhost', 'state', ['email']);

      expect(url).toContain('scope=email');
      expect(url).not.toContain('openid');
    });
  });

  describe('exchangeCode', () => {
    it('exchanges code for access token', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ access_token: 'google-token-123' }),
      });

      const result = await provider.exchangeCode('auth-code', 'http://localhost/callback', 'client-id', 'client-secret');

      expect(result).toEqual({ accessToken: 'google-token-123' });
      expect(fetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );
    });

    it('throws UnauthorizedException on failure', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        text: vi.fn().mockResolvedValue('{"error":"invalid_grant"}'),
      });

      await expect(provider.exchangeCode('bad-code', 'http://localhost', 'id', 'secret'))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getUserProfile', () => {
    it('fetches and maps user profile', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: 'google-uid-456',
          email: 'jane@gmail.com',
          given_name: 'Jane',
          family_name: 'Smith',
          picture: 'https://lh3.googleusercontent.com/photo.jpg',
        }),
      });

      const profile = await provider.getUserProfile('access-token');

      expect(profile).toEqual({
        providerUserId: 'google-uid-456',
        email: 'jane@gmail.com',
        firstName: 'Jane',
        lastName: 'Smith',
        avatarUrl: 'https://lh3.googleusercontent.com/photo.jpg',
      });
      expect(fetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        { headers: { Authorization: 'Bearer access-token' } },
      );
    });

    it('handles missing name fields', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: 'google-uid-789',
          email: 'noname@gmail.com',
        }),
      });

      const profile = await provider.getUserProfile('token');

      expect(profile.firstName).toBe('');
      expect(profile.lastName).toBe('');
    });

    it('throws UnauthorizedException on failure', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false });

      await expect(provider.getUserProfile('bad-token'))
        .rejects.toThrow(UnauthorizedException);
    });
  });
});
