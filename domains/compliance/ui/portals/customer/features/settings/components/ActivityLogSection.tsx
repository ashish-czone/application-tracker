import { useMemo, useState } from 'react';
import { DataGridShell, SearchInput } from '@packages/ui';
import { ACTIVITY_LOG } from '../data/settingsMock';
import { ACTIVITY_COLUMNS } from './activityColumns';

export function ActivityLogSection() {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ACTIVITY_LOG;
    return ACTIVITY_LOG.filter(
      (e) =>
        e.action.toLowerCase().includes(q) ||
        e.entity.toLowerCase().includes(q) ||
        e.detail.toLowerCase().includes(q),
    );
  }, [search]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl text-ink leading-tight">Activity log</h2>
        <p className="mt-1 font-serif italic text-sm text-ink-soft">
          Your recent actions and login history.
        </p>
      </div>

      <DataGridShell
        columns={ACTIVITY_COLUMNS}
        rows={filtered}
        getRowKey={(e) => e.id}
        totalRows={ACTIVITY_LOG.length}
        activeFilters={[]}
        onClearFilters={() => {}}
        filters={
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search activity..."
            wrapperClassName="min-w-[200px] max-w-xs flex-1"
          />
        }
      />
    </div>
  );
}
