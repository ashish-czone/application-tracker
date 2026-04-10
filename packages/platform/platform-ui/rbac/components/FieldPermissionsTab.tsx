import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { Button, Skeleton, toast } from '@packages/ui';
import { useEntityEngine } from '@packages/entity-engine-ui';
import { usePlatformAPI } from '../../PlatformUIProvider';

type FieldAccess = 'read_write' | 'read_only' | 'hidden';

interface FieldPermissionEntry {
  fieldKey: string;
  label: string;
  fieldType: string;
  isSystem: boolean;
  isRequired: boolean;
  access: FieldAccess;
}

function useFieldPermissions(roleId: string, entityType: string) {
  const api = usePlatformAPI();
  return useQuery({
    queryKey: ['field-permissions', roleId, entityType],
    queryFn: () =>
      api.get<FieldPermissionEntry[]>(`/field-permissions/roles/${roleId}/entities/${entityType}`),
    enabled: !!roleId && !!entityType,
  });
}

function useSaveFieldPermissions() {
  const api = usePlatformAPI();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, entityType, fields }: {
      roleId: string;
      entityType: string;
      fields: { fieldKey: string; access: FieldAccess }[];
    }) =>
      api.put<FieldPermissionEntry[]>(
        `/field-permissions/roles/${roleId}/entities/${entityType}`,
        { fields },
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['field-permissions', variables.roleId, variables.entityType] });
      toast.success('Field permissions saved');
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to save field permissions');
    },
  });
}

const ACCESS_LABELS: Record<FieldAccess, string> = {
  read_write: 'Read & Write',
  read_only: 'Read Only',
  hidden: 'Hidden',
};

interface FieldPermissionsTabProps {
  roleId: string;
  disabled?: boolean;
}

export function FieldPermissionsTab({ roleId, disabled }: FieldPermissionsTabProps) {
  const { entities } = useEntityEngine();
  const [selectedEntity, setSelectedEntity] = useState('');
  const [localState, setLocalState] = useState<Record<string, FieldAccess>>({});
  const [isDirty, setIsDirty] = useState(false);

  // Default to first entity
  useEffect(() => {
    if (entities.length > 0 && !selectedEntity) {
      setSelectedEntity(entities[0].entityType);
    }
  }, [entities, selectedEntity]);

  const { data: fields, isLoading } = useFieldPermissions(roleId, selectedEntity);
  const saveMutation = useSaveFieldPermissions();

  // Sync server state to local state when data loads
  useEffect(() => {
    if (fields) {
      const state: Record<string, FieldAccess> = {};
      for (const f of fields) state[f.fieldKey] = f.access;
      setLocalState(state);
      setIsDirty(false);
    }
  }, [fields]);

  function handleAccessChange(fieldKey: string, access: FieldAccess) {
    setLocalState((prev) => ({ ...prev, [fieldKey]: access }));
    setIsDirty(true);
  }

  function handleSave() {
    const entries = Object.entries(localState).map(([fieldKey, access]) => ({ fieldKey, access }));
    saveMutation.mutate({ roleId, entityType: selectedEntity, fields: entries });
    setIsDirty(false);
  }

  function handleEntityChange(entityType: string) {
    setSelectedEntity(entityType);
    setIsDirty(false);
  }

  return (
    <div className="space-y-4">
      {disabled && (
        <div className="rounded-md bg-muted/50 border border-border px-3 py-3 space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
            System role — all fields visible
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed pl-6">
            This system role has full read and write access to all fields. Field permissions cannot be restricted for this role.
          </p>
        </div>
      )}

      {/* Entity selector */}
      <div className="flex items-center justify-between">
        <select
          value={selectedEntity}
          onChange={(e) => handleEntityChange(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {entities
            .sort((a, b) => (a.ui.navOrder ?? 99) - (b.ui.navOrder ?? 99))
            .map((e) => (
              <option key={e.entityType} value={e.entityType}>
                {e.pluralName}
              </option>
            ))}
        </select>

        {isDirty && !disabled && (
          <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving...' : 'Save changes'}
          </Button>
        )}
      </div>

      {/* Field matrix */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : fields && fields.length > 0 ? (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Field</th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground w-32">Read &amp; Write</th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground w-28">Read Only</th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground w-24">Hidden</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => {
                const access = localState[field.fieldKey] ?? 'read_write';
                const isLocked = disabled || field.isSystem || field.isRequired;
                return (
                  <tr key={field.fieldKey} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{field.label}</span>
                        {field.isSystem && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">System</span>
                        )}
                        {field.isRequired && !field.isSystem && (
                          <span className="text-destructive text-xs">*</span>
                        )}
                      </div>
                    </td>
                    {(['read_write', 'read_only', 'hidden'] as FieldAccess[]).map((opt) => (
                      <td key={opt} className="text-center px-3 py-2">
                        <input
                          type="radio"
                          name={`field-${field.fieldKey}`}
                          checked={access === opt}
                          onChange={() => handleAccessChange(field.fieldKey, opt)}
                          disabled={isLocked}
                          className="h-4 w-4 text-primary border-input disabled:opacity-30"
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8">
          No fields found for this entity.
        </p>
      )}
    </div>
  );
}
