import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { OAuthProvider, OAuthUserProfile } from './oauth-provider.interface';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

@Injectable()
export class GoogleOAuthProvider implements OAuthProvider {
  readonly provider = 'google';
  readonly defaultScopes = ['openid', 'email', 'profile'];

  getAuthorizationUrl(clientId: string, redirectUri: string, state: string, scopes?: string[]): string {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: (scopes ?? this.defaultScopes).join(' '),
      state,
      access_type: 'offline',
      prompt: 'consent',
    });

    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string, clientId: string, clientSecret: string): Promise<{ accessToken: string }> {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new UnauthorizedException(`Failed to exchange OAuth code: ${errorBody}`);
    }

    const data = await response.json() as { access_token: string };
    return { accessToken: data.access_token };
  }

  async getUserProfile(accessToken: string): Promise<OAuthUserProfile> {
    const response = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new UnauthorizedException('Failed to fetch user profile from Google');
    }

    const data = await response.json() as {
      id: string;
      email: string;
      given_name?: string;
      family_name?: string;
      picture?: string;
    };

    return {
      providerUserId: data.id,
      email: data.email,
      firstName: data.given_name ?? '',
      lastName: data.family_name ?? '',
      avatarUrl: data.picture,
    };
  }
}
