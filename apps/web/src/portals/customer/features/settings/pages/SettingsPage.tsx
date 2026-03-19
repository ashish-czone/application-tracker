import { useState } from 'react';
import { Settings } from 'lucide-react';
import { cn } from '@packages/ui';
import { useSettings } from '../hooks';
import { SettingField } from '../components/SettingField';

export default function SettingsPage() {
  const { data: groups, isLoading } = useSettings();
  const [activeModule, setActiveModule] = useState<string | null>(null);

  // Auto-select first module
  const selectedModule = activeModule ?? groups?.[0]?.module ?? null;
  const selectedGroup = groups?.find((g) => g.module === selectedModule);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-48 animate-pulse rounded bg-muted" />
        <div className="h-96 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (!groups || groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Settings className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-sm font-medium text-foreground mb-1">No settings registered</h3>
        <p className="text-sm text-muted-foreground">Modules will register their settings on startup.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure module settings</p>
      </div>

      {/* Horizontal tabs */}
      <div className="border-b border-border mb-6">
        <nav className="flex gap-0 -mb-px">
          {groups.map((group) => (
            <button
              key={group.module}
              type="button"
              onClick={() => setActiveModule(group.module)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                selectedModule === group.module
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
              )}
            >
              {group.label}
              <span className="ml-1.5 text-[10px] text-muted-foreground">
                ({group.fields.length})
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Settings fields */}
      <div>
          {selectedGroup ? (
            <div className="rounded-lg border bg-card">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="text-sm font-medium text-foreground">{selectedGroup.label}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedGroup.fields.filter((f) => f.isOverridden).length} of {selectedGroup.fields.length} settings overridden
                </p>
              </div>
              <div className="px-5">
                {selectedGroup.fields.map((field) => (
                  <SettingField
                    key={field.key}
                    field={field}
                    module={selectedGroup.module}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Select a module</div>
          )}
      </div>
    </div>
  );
}
