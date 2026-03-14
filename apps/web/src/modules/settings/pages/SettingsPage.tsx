import { useSettings } from '../hooks/useSettings';
import { useUpdateSettings, useResetSetting } from '../hooks/useUpdateSettings';
import { SettingsModuleGroup } from '../components/SettingsModuleGroup';

export function SettingsPage() {
  const { data: groups, isLoading, error } = useSettings();
  const updateMutation = useUpdateSettings();
  const resetMutation = useResetSetting();

  const handleSave = (module: string, settings: Array<{ key: string; value: unknown }>) => {
    updateMutation.mutate({ module, settings });
  };

  const handleReset = (module: string, key: string) => {
    resetMutation.mutate({ module, key });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl">
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4">
          <p className="text-sm text-destructive">Failed to load settings. You may not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">
          Configure platform modules. Changes marked "Restart required" take effect after server restart.
        </p>
      </div>

      {groups && groups.length === 0 && (
        <div className="bg-white rounded-xl border border-border/60 p-8 text-center">
          <p className="text-sm text-muted-foreground">No configurable modules registered.</p>
        </div>
      )}

      <div className="space-y-4">
        {groups?.map((group) => (
          <SettingsModuleGroup
            key={group.module}
            group={group}
            onSave={handleSave}
            onReset={handleReset}
            isSaving={updateMutation.isPending}
          />
        ))}
      </div>
    </div>
  );
}
