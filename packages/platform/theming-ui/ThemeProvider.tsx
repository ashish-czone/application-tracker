import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { applyThemeToDom, isDarkMode, resetThemeDom } from './css-vars';
import { DEFAULT_THEME, normalizeTheme } from './theme-config';
import { createThemingApi, THEME_PREFERENCE_KEY, THEMING_NAMESPACE } from './services';
import type { ApiFn, ThemeConfig } from './types';

interface ThemeContextValue {
  theme: ThemeConfig;
  setTheme: (next: ThemeConfig) => void;
  resetTheme: () => void;
  isDark: boolean;
  isLoaded: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_QUERY_KEY = ['user-preferences', THEMING_NAMESPACE, THEME_PREFERENCE_KEY] as const;

interface ThemeProviderProps {
  apiFn: ApiFn;
  /** Render children immediately with the default theme, or wait for the preference to load. */
  suspendUntilLoaded?: boolean;
  /** Called whenever the authenticated user is not yet available. The provider skips the fetch until this returns true. */
  enabled?: boolean;
  children: ReactNode;
}

export function ThemeProvider({ apiFn, suspendUntilLoaded = false, enabled = true, children }: ThemeProviderProps) {
  const api = useMemo(() => createThemingApi(apiFn), [apiFn]);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: THEME_QUERY_KEY,
    queryFn: () => api.getTheme(),
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: (next: ThemeConfig) => api.setTheme(next),
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: THEME_QUERY_KEY });
      const previous = queryClient.getQueryData<ThemeConfig | null>(THEME_QUERY_KEY);
      queryClient.setQueryData(THEME_QUERY_KEY, next);
      return { previous };
    },
    onError: (_err, _next, ctx) => {
      if (ctx) queryClient.setQueryData(THEME_QUERY_KEY, ctx.previous);
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => api.resetTheme(),
    onSuccess: () => {
      queryClient.setQueryData(THEME_QUERY_KEY, null);
    },
  });

  const theme = useMemo(
    () => normalizeTheme(query.data ?? DEFAULT_THEME),
    [query.data],
  );

  // Track dark mode separately so "system" reacts to OS changes without a save.
  const [isDark, setIsDark] = useState<boolean>(() => isDarkMode(theme));

  useEffect(() => {
    setIsDark(isDarkMode(theme));

    if (theme.mode !== 'system' || typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  useEffect(() => {
    applyThemeToDom(theme);
    return () => {
      // Only reset on full unmount — not on every re-apply.
    };
  }, [theme, isDark]);

  useEffect(() => {
    return () => {
      resetThemeDom();
    };
  }, []);

  const setTheme = useCallback(
    (next: ThemeConfig) => {
      mutation.mutate(next);
    },
    [mutation],
  );

  const resetTheme = useCallback(() => {
    resetMutation.mutate();
  }, [resetMutation]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      resetTheme,
      isDark,
      isLoaded: !query.isLoading,
    }),
    [theme, setTheme, resetTheme, isDark, query.isLoading],
  );

  if (suspendUntilLoaded && query.isLoading) {
    return null;
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a <ThemeProvider>');
  }
  return ctx;
}
