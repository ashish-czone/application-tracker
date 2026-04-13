import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Skeleton,
} from '@packages/ui';
import { usePlatformAPI } from '@packages/platform-ui';
import { usePositionScopes, useSetPositionScopes } from '../hooks';
import type { OrgPosition } from '../types';

/** Built-in scope levels available for all entities */
const BUILT_IN_SCOPES = [
  { value: 'all', label: 'All records' },
  { value: 'descendants', label: 'Own unit + descendants' },
  { value: 'unit', label: 'Own unit only' },
  { value: 'own', label: 'Own records only' },
];

interface EntityRegistryEntry {
  entityType: string;
  singularName: string;
  pluralName: string;
  slug: string;
}

interface PositionScopesEditorProps {
  position: OrgPosition | null;
  onClose: () => void;
}

export function PositionScopesEditor({ position, onClose }: PositionScopesEditorProps) {
  const apiFn = usePlatformAPI();
  const { data: currentScopes, isLoading: scopesLoading } = usePositionScopes(position?.id ?? null);
  const { data: entityRegistry, isLoading: registryLoading } = useQuery({
    queryKey: ['entity-engine', 'registry'],
    queryFn: () => apiFn.get<EntityRegistryEntry[]>('/entity-engine/registry'),
    staleTime: Infinity,
  });
  const setScopesMutation = useSetPositionScopes({ onSuccess: onClose });

  const [scopeMap, setScopeMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (currentScopes) {
      const map: Record<string, string> = {};
      for (const s of currentScopes) {
        map[s.entityType] = s.scope;
      }
      setScopeMap(map);
    }
  }, [currentScopes]);

  function handleScopeChange(entityType: string, scope: string) {
    setScopeMap((prev) => {
      if (scope === '') {
        const next = { ...prev };
        delete next[entityType];
        return next;
      }
      return { ...prev, [entityType]: scope };
    });
  }

  function handleSave() {
    if (!position) return;
    const scopes = Object.entries(scopeMap).map(([entityType, scope]) => ({ entityType, scope }));
    setScopesMutation.mutate({ positionId: position.id, data: { scopes } });
  }

  const isLoading = scopesLoading || registryLoading;

  return (
    <Dialog open={!!position} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Data Access Scopes — {position?.name}</DialogTitle>
          <DialogDescription>
            Configure which records users with this position can see, per entity type.
            Unset entities default to "Own records only".
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-4">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-9 w-48" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-[1fr_200px] gap-4 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <span>Entity</span>
                <span>Scope</span>
              </div>
              {(entityRegistry ?? []).map((entity) => (
                <div
                  key={entity.entityType}
                  className="grid grid-cols-[1fr_200px] gap-4 items-center px-3 py-2 rounded-md hover:bg-muted/50"
                >
                  <div>
                    <div className="text-sm font-medium text-foreground">{entity.pluralName}</div>
                    <div className="text-xs text-muted-foreground">{entity.slug}</div>
                  </div>
                  <select
                    value={scopeMap[entity.entityType] ?? ''}
                    onChange={(e) => handleScopeChange(entity.entityType, e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Default (own)</option>
                    {BUILT_IN_SCOPES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              ))}
              {(entityRegistry ?? []).length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-8">
                  No entity types registered yet.
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={setScopesMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={setScopesMutation.isPending || isLoading}>
            {setScopesMutation.isPending ? 'Saving...' : 'Save scopes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
