import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { AuthLayout } from '../components/AuthLayout';
import { useOAuthLogin } from '../hooks/useOAuthLogin';

export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const oauthLogin = useOAuthLogin();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      navigate('/login', { replace: true, state: { error: `OAuth error: ${error}` } });
      return;
    }

    if (!code || !state) {
      navigate('/login', { replace: true, state: { error: 'Invalid OAuth callback' } });
      return;
    }

    // Validate state against sessionStorage (CSRF protection)
    const storedState = sessionStorage.getItem('oauth_state');
    const storedProvider = sessionStorage.getItem('oauth_provider');
    sessionStorage.removeItem('oauth_state');
    sessionStorage.removeItem('oauth_provider');

    if (!storedState || storedState !== state) {
      navigate('/login', { replace: true, state: { error: 'Invalid OAuth state' } });
      return;
    }

    if (!storedProvider) {
      navigate('/login', { replace: true, state: { error: 'Missing OAuth provider' } });
      return;
    }

    const redirectUri = `${window.location.origin}/oauth/callback`;
    oauthLogin.mutate(
      { provider: storedProvider, code, redirectUri },
      {
        onError: () => {
          navigate('/login', { replace: true, state: { error: 'OAuth login failed. Please try again.' } });
        },
      },
    );
  }, [searchParams, navigate, oauthLogin]);

  return (
    <AuthLayout>
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Completing sign in...</p>
      </div>
    </AuthLayout>
  );
}
