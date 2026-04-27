import { type DataTableColumn } from '@packages/ui';
import { OrdinalDate, ColoredInitialsAvatar } from '../../../../../components';
import type { UserRow } from '../types';
import { StatusPill } from './StatusPill';
import { RoleBadge } from './RoleBadge';

export const REQUIRED_USER_COLUMN_KEYS: string[] = ['name'];

export const USER_COLUMNS: DataTableColumn<UserRow>[] = [
  {
    key: 'name',
    header: 'Name',
    cell: (u) => (
      <div className="flex items-center gap-3 min-w-0">
        <ColoredInitialsAvatar initials={u.initials} color={u.color} size="lg" />
        <div className="min-w-0">
          <span className="text-sm text-ink font-sans leading-snug truncate block">{u.name}</span>
          <span className="font-mono text-[11px] text-ink-muted truncate block">{u.email}</span>
        </div>
      </div>
    ),
  },
  {
    key: 'roles',
    header: 'Roles',
    width: '220px',
    cell: (u) =>
      u.roles.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {u.roles.map((r) => (
            <RoleBadge key={r.id} name={r.name} />
          ))}
        </div>
      ) : (
        <span className="text-ink-muted text-[11px] italic">None</span>
      ),
  },
  {
    key: 'position',
    header: 'Position',
    width: '200px',
    cell: (u) =>
      u.positions.length > 0 ? (
        <div className="min-w-0">
          <span className="text-sm text-ink font-sans leading-snug truncate block">
            {u.positions[0].title}
          </span>
          <span className="font-serif italic text-[11px] text-ink-muted truncate block">
            {u.positions[0].unitName}
          </span>
        </div>
      ) : (
        <span className="text-ink-muted text-[11px] italic">—</span>
      ),
  },
  {
    key: 'status',
    header: 'Status',
    width: '120px',
    cell: (u) => <StatusPill status={u.status} />,
  },
  {
    key: 'lastActiveAt',
    header: 'Last active',
    width: '120px',
    cell: (u) =>
      u.lastActiveAt ? (
        <OrdinalDate date={u.lastActiveAt} variant="short" className="text-[11px]" />
      ) : (
        <span className="text-ink-muted text-[11px] italic">Never</span>
      ),
  },
];
