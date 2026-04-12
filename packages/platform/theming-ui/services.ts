import type { ApiFn, ThemeConfig } from './types';

export const THEMING_NAMESPACE = 'theming';
export const THEME_PREFERENCE_KEY = 'theme';

interface UserPreferenceRow {
  id: string;
  userId: string;
  namespace: string;
  key: string;
  value: unknown;
  createdAt: string;
  updatedAt: string;
}

/**
 * API client for the theming preference. Uses the generic user-preferences
 * endpoint exposed by @packages/user-preferences — no theming-specific
 * backend code is needed.
 */
export function createThemingApi(api: ApiFn) {
  return {
    async getTheme(): Promise<ThemeConfig | null> {
      try {
        const row = await api.get<UserPreferenceRow>(
          `/me/preferences/${THEMING_NAMESPACE}/${THEME_PREFERENCE_KEY}`,
        );
        return row.value as ThemeConfig;
      } catch (err: unknown) {
        if (isNotFound(err)) return null;
        throw err;
      }
    },

    async setTheme(theme: ThemeConfig): Promise<ThemeConfig> {
      const row = await api.put<UserPreferenceRow>(
        `/me/preferences/${THEMING_NAMESPACE}/${THEME_PREFERENCE_KEY}`,
        { value: theme },
      );
      return row.value as ThemeConfig;
    },

    async resetTheme(): Promise<void> {
      await api.delete<void>(
        `/me/preferences/${THEMING_NAMESPACE}/${THEME_PREFERENCE_KEY}`,
      );
    },
  };
}

function isNotFound(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const anyErr = err as { status?: number; statusCode?: number; response?: { status?: number } };
  const status = anyErr.status ?? anyErr.statusCode ?? anyErr.response?.status;
  return status === 404;
}

export type ThemingApi = ReturnType<typeof createThemingApi>;
