import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import { usePlatformAPI } from '@packages/platform-ui/PlatformUIProvider';
import { createDraftsApi } from './services';
import type { SaveDraftRequest, Draft, DraftSaveStatus } from './types';

function useDraftsApi() {
  const apiFn = usePlatformAPI();
  return useMemo(() => createDraftsApi(apiFn), [apiFn]);
}

// ---------------------------------------------------------------------------
// Basic CRUD hooks
// ---------------------------------------------------------------------------

export function useDraft(entityType: string, draftKey: string) {
  const api = useDraftsApi();
  return useQuery({
    queryKey: ['drafts', entityType, draftKey],
    queryFn: () => api.getDraft(entityType, draftKey),
    enabled: !!entityType && !!draftKey,
    retry: false,
  });
}

export function useDrafts(entityType?: string) {
  const api = useDraftsApi();
  return useQuery({
    queryKey: ['drafts', entityType ?? '__all__'],
    queryFn: () => api.listDrafts(entityType),
  });
}

export function useSaveDraft() {
  const api = useDraftsApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SaveDraftRequest) => api.saveDraft(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['drafts', variables.entityType, variables.draftKey] });
    },
  });
}

export function useDeleteDraft() {
  const api = useDraftsApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entityType, draftKey }: { entityType: string; draftKey: string }) =>
      api.deleteDraft(entityType, draftKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Auto-save hook — debounces form data and persists to drafts API
// ---------------------------------------------------------------------------

interface UseAutoSaveDraftOptions {
  debounceMs?: number;
  enabled?: boolean;
}

export function useAutoSaveDraft(
  entityType: string,
  draftKey: string,
  data: Record<string, unknown> | null,
  options: UseAutoSaveDraftOptions = {},
) {
  const { debounceMs = 3000, enabled = true } = options;
  const api = useDraftsApi();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<DraftSaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedJson = useRef<string>('');
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (!enabled || !data || !entityType || !draftKey) return;

    const json = JSON.stringify(data);
    // Skip if data hasn't changed since last save
    if (json === lastSavedJson.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      if (!isMounted.current) return;
      setStatus('saving');
      try {
        await api.saveDraft({ entityType, draftKey, data });
        if (!isMounted.current) return;
        lastSavedJson.current = json;
        setStatus('saved');
        setLastSavedAt(new Date());
        queryClient.invalidateQueries({ queryKey: ['drafts', entityType, draftKey] });
      } catch {
        if (!isMounted.current) return;
        setStatus('error');
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, entityType, draftKey, debounceMs, enabled, api, queryClient]);

  const saveNow = useCallback(async () => {
    if (!data || !entityType || !draftKey) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus('saving');
    try {
      await api.saveDraft({ entityType, draftKey, data });
      lastSavedJson.current = JSON.stringify(data);
      setStatus('saved');
      setLastSavedAt(new Date());
      queryClient.invalidateQueries({ queryKey: ['drafts', entityType, draftKey] });
    } catch {
      setStatus('error');
    }
  }, [data, entityType, draftKey, api, queryClient]);

  return { status, lastSavedAt, saveNow };
}

// ---------------------------------------------------------------------------
// Draft recovery hook — checks for existing draft and provides restore/discard
// ---------------------------------------------------------------------------

export function useDraftRecovery(entityType: string, draftKey: string) {
  const { data: draft, isLoading } = useDraft(entityType, draftKey);
  const deleteMutation = useDeleteDraft();
  const [dismissed, setDismissed] = useState(false);

  const hasDraft = !isLoading && !dismissed && !!draft;

  const discard = useCallback(() => {
    deleteMutation.mutate({ entityType, draftKey });
    setDismissed(true);
    toast.success('Draft discarded');
  }, [entityType, draftKey, deleteMutation]);

  const dismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  return {
    hasDraft,
    draft: hasDraft ? draft : null,
    isLoading,
    discard,
    dismiss,
  };
}

// ---------------------------------------------------------------------------
// Composable hook — single hook to make any form draftable
// ---------------------------------------------------------------------------

interface UseFormDraftsOptions {
  entityType: string;
  draftKey: string;
  /** Current form values — typically `form.watch()` */
  formValues: Record<string, unknown> | null;
  /** Called with saved draft data when user clicks Restore — typically `(data) => form.reset(data)` */
  onRestore: (data: Record<string, unknown>) => void;
  enabled?: boolean;
  debounceMs?: number;
}

export function useFormDrafts(options: UseFormDraftsOptions) {
  const { entityType, draftKey, formValues, onRestore, enabled = true, debounceMs } = options;

  const { hasDraft, draft, isLoading: draftLoading, discard: discardInternal, dismiss } = useDraftRecovery(entityType, draftKey);
  const deleteDraftMutation = useDeleteDraft();

  const autoSave = useAutoSaveDraft(entityType, draftKey, formValues, {
    enabled: enabled && !hasDraft && !draftLoading,
    debounceMs,
  });

  const restore = useCallback((data: Record<string, unknown>) => {
    onRestore(data);
    dismiss();
    toast.success('Draft restored');
  }, [onRestore, dismiss]);

  const saveAsDraft = useCallback(async () => {
    await autoSave.saveNow();
    toast.success('Draft saved');
  }, [autoSave]);

  const cleanup = useCallback(() => {
    deleteDraftMutation.mutate({ entityType, draftKey });
  }, [deleteDraftMutation, entityType, draftKey]);

  return {
    hasDraft,
    draft,
    /** Spread onto <DraftRecoveryBanner /> — null when no draft to recover */
    bannerProps: hasDraft && draft ? { draft, onRestore: restore, onDiscard: discardInternal } : null,
    /** Spread onto <DraftStatusIndicator /> */
    statusProps: { status: autoSave.status, lastSavedAt: autoSave.lastSavedAt },
    /** Explicit save-as-draft action with toast */
    saveAsDraft,
    /** Delete draft — call on successful entity creation */
    cleanup,
  };
}
