import { useMemo, useState } from 'react';
import { Building2, ChevronRight, Plus, MoreHorizontal, Shield, Users } from 'lucide-react';
import { Eyebrow, CoarseTabs, type CoarseTabItem } from '@packages/ui';
import type { OrgUnit, OrgUnitMemberDetail } from '@packages/org-units-ui';
import { useOrgUnitMembers } from '@packages/org-units-ui';
import {
  buildBreadcrumb,
  getUnitChildren,
  getInitials,
  levelTagClass,
} from '../helpers';
import {
  useLawHandlersByOrgUnit,
  type OrgUnitLawAssignment,
} from '../../../../../hooks/useLawHandlersByOrgUnit';

type DetailTab = 'members' | 'sub-units' | 'compliance';

const TABS: CoarseTabItem<DetailTab>[] = [
  { value: 'members', label: 'Members' },
  { value: 'sub-units', label: 'Sub Units' },
  { value: 'compliance', label: 'Compliance' },
];

interface UnitDetailPanelProps {
  unit: OrgUnit;
  allUnits: OrgUnit[];
  onAddMember?: () => void;
}

export function UnitDetailPanel({
  unit,
  allUnits,
  onAddMember,
}: UnitDetailPanelProps) {
  const [tab, setTab] = useState<DetailTab>('members');
  const { data: membersData, isLoading: membersLoading } = useOrgUnitMembers(unit.id);
  const members = useMemo<OrgUnitMemberDetail[]>(() => membersData ?? [], [membersData]);

  const breadcrumb = useMemo(() => buildBreadcrumb(allUnits, unit.id), [allUnits, unit.id]);
  const children = useMemo(() => getUnitChildren(allUnits, unit.id), [allUnits, unit.id]);
  const {
    data: lawAssignments,
    total: lawAssignmentsTotal,
    hasMore: lawAssignmentsHasMore,
    isLoading: lawAssignmentsLoading,
    isFetchingNextPage: lawAssignmentsFetchingMore,
    fetchNextPage: fetchMoreLawAssignments,
  } = useLawHandlersByOrgUnit(unit.id);

  const head = unit.head;

  const tabsWithCount: CoarseTabItem<DetailTab>[] = TABS.map((t) => {
    if (t.value === 'members') return { ...t, count: unit.memberCount };
    if (t.value === 'sub-units') return { ...t, count: children.length };
    // Use server-known total so the tab badge reflects the full count
    // even when only the first page has loaded.
    if (t.value === 'compliance') return { ...t, count: lawAssignmentsTotal };
    return t;
  });

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 pt-6 pb-0">
        <nav className="flex items-center gap-1 text-[10px] uppercase tracking-eyebrow font-sans text-ink-muted mb-3">
          {breadcrumb.map((crumb, i) => (
            <span key={crumb.id} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="w-2.5 h-2.5" strokeWidth={2} />}
              <span className={i === breadcrumb.length - 1 ? 'text-ink font-medium' : ''}>
                {crumb.name}
              </span>
            </span>
          ))}
        </nav>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-serif text-2xl text-ink leading-none">{unit.name}</h2>
              <span className={`px-1.5 py-0.5 text-[9px] uppercase tracking-eyebrow font-sans font-semibold ${levelTagClass(unit.level.sortOrder)}`}>
                {unit.level.name}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="w-8 h-8 flex items-center justify-center border border-rule hover:border-ink text-ink-muted hover:text-ink transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex items-center gap-6 mt-4 pb-4 border-b border-rule">
          {head ? (
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 bg-authority text-paper text-[9px] font-sans font-semibold flex items-center justify-center">
                {getInitials(head.userName)}
              </span>
              <div>
                <div className="text-[11px] font-sans text-ink leading-none">{head.userName}</div>
                <div className="text-[9px] uppercase tracking-eyebrow text-ink-muted font-sans mt-0.5">
                  {head.positionName || 'Head'}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-ink-muted">
              <span className="w-6 h-6 border border-rule border-dashed text-[9px] font-sans flex items-center justify-center">?</span>
              <span className="text-[10px] italic font-sans">No head assigned</span>
            </div>
          )}
          <div className="h-4 border-l border-rule" />
          <div className="text-[11px] font-sans text-ink-muted">
            <span className="text-ink font-medium">{unit.memberCount}</span> members
          </div>
          {children.length > 0 && (
            <>
              <div className="h-4 border-l border-rule" />
              <div className="text-[11px] font-sans text-ink-muted">
                <span className="text-ink font-medium">{children.length}</span> sub-units
              </div>
            </>
          )}
          {lawAssignmentsTotal > 0 && (
            <>
              <div className="h-4 border-l border-rule" />
              <div className="text-[11px] font-sans text-ink-muted">
                <span className="text-ink font-medium">{lawAssignmentsTotal}</span> laws assigned
              </div>
            </>
          )}
        </div>

        <div className="mt-0">
          <CoarseTabs tabs={tabsWithCount} value={tab} onChange={setTab} animated />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {tab === 'sub-units' && (
          <SubUnitsTab unit={unit} children={children} />
        )}
        {tab === 'members' && (
          <MembersTab members={members} isLoading={membersLoading} onAddMember={onAddMember} />
        )}
        {tab === 'compliance' && (
          <ComplianceTab
            assignments={lawAssignments}
            total={lawAssignmentsTotal}
            hasMore={lawAssignmentsHasMore}
            isLoading={lawAssignmentsLoading}
            isFetchingMore={lawAssignmentsFetchingMore}
            onLoadMore={fetchMoreLawAssignments}
          />
        )}
      </div>
    </div>
  );
}

function SubUnitsTab({
  unit,
  children,
}: {
  unit: OrgUnit;
  children: OrgUnit[];
}) {
  return (
    <div className="space-y-6">
      <div>
        <Eyebrow tone="muted">Description</Eyebrow>
        {unit.description ? (
          <p className="mt-2 font-serif text-[14px] text-ink leading-relaxed italic">
            {unit.description}
          </p>
        ) : (
          <p className="mt-2 font-serif italic text-ink-muted text-sm">
            No description yet.
          </p>
        )}
      </div>

      {children.length > 0 ? (
        <div>
          <Eyebrow tone="muted">Sub-units</Eyebrow>
          <div className="mt-2 space-y-1">
            {children.map((child) => (
              <div
                key={child.id}
                className="flex items-center gap-3 px-3 py-2.5 border border-rule hover:border-ink-muted transition-colors"
              >
                <span className={`px-1.5 py-0.5 text-[9px] uppercase tracking-eyebrow font-sans font-semibold ${levelTagClass(child.level.sortOrder)}`}>
                  {child.level.name}
                </span>
                <span className="font-sans text-[13px] text-ink flex-1">{child.name}</span>
                {child.head && (
                  <span className="w-5 h-5 bg-ink-muted text-paper text-[8px] font-sans font-semibold flex items-center justify-center" title={child.head.userName}>
                    {getInitials(child.head.userName)}
                  </span>
                )}
                <span className="text-[10px] font-mono tabular-nums text-ink-muted">
                  {child.memberCount} members
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="py-8 text-center">
          <Building2 className="w-8 h-8 text-ink-muted/40 mx-auto mb-3" strokeWidth={1} />
          <p className="font-serif italic text-ink-muted text-sm">Leaf unit — no sub-units</p>
        </div>
      )}
    </div>
  );
}

function MembersTab({
  members,
  isLoading,
  onAddMember,
}: {
  members: OrgUnitMemberDetail[];
  isLoading: boolean;
  onAddMember?: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <Eyebrow tone="muted">Team Members</Eyebrow>
        <button
          type="button"
          onClick={() => onAddMember?.()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-eyebrow font-sans font-medium border border-rule hover:border-ink text-ink-muted hover:text-ink transition-colors"
        >
          <Plus className="w-3 h-3" strokeWidth={2} />
          Add Member
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 bg-paper-sunken/30 border border-rule" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <div className="py-12 text-center">
          <Users className="w-8 h-8 text-ink-muted/40 mx-auto mb-3" strokeWidth={1} />
          <p className="font-serif italic text-ink-muted text-sm">No members assigned</p>
          <p className="text-[10px] text-ink-muted/70 font-sans mt-1">
            Add team members to this organisational unit.
          </p>
        </div>
      ) : (
        <div className="border border-rule divide-y divide-rule">
          {members.map((member) => (
            <div
              key={member.userId}
              className="flex items-center gap-3 px-4 py-3 hover:bg-paper-sunken/30 transition-colors"
            >
              <span className="w-7 h-7 bg-ink text-paper text-[10px] font-sans font-semibold flex items-center justify-center shrink-0">
                {getInitials(member.userName)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-sans text-ink leading-none">{member.userName}</div>
              </div>
              {member.positionName && (
                <span className="px-2 py-0.5 text-[9px] uppercase tracking-eyebrow font-sans font-semibold bg-paper-sunken text-ink-muted">
                  {member.positionName}
                </span>
              )}
              <button
                type="button"
                className="w-6 h-6 flex items-center justify-center text-ink-muted/40 hover:text-ink transition-colors"
              >
                <MoreHorizontal className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ComplianceTab({
  assignments,
  total,
  hasMore,
  isLoading,
  isFetchingMore,
  onLoadMore,
}: {
  assignments: OrgUnitLawAssignment[];
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  isFetchingMore: boolean;
  onLoadMore: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <Eyebrow tone="muted">Assigned Laws</Eyebrow>
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-eyebrow font-sans font-medium border border-rule hover:border-ink text-ink-muted hover:text-ink transition-colors"
        >
          <Plus className="w-3 h-3" strokeWidth={2} />
          Assign Law
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 bg-paper-sunken/30 border border-rule" />
          ))}
        </div>
      ) : assignments.length === 0 ? (
        <div className="py-12 text-center">
          <Shield className="w-8 h-8 text-ink-muted/40 mx-auto mb-3" strokeWidth={1} />
          <p className="font-serif italic text-ink-muted text-sm">No laws assigned</p>
          <p className="text-[10px] text-ink-muted/70 font-sans mt-1">
            Assign compliance laws to make this unit responsible for their obligations.
          </p>
        </div>
      ) : (
        <>
          <div className="border border-rule divide-y divide-rule">
            {assignments.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-4 px-4 py-3 hover:bg-paper-sunken/30 transition-colors"
              >
                <span className="font-mono text-[11px] tracking-wider text-ink-muted w-10 shrink-0">
                  {a.lawCode}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-sans text-ink leading-none truncate">
                    {a.lawName}
                  </div>
                  <div className="text-[10px] text-ink-muted font-sans mt-1">
                    {a.isGlobal ? 'Default handler' : 'Client override'}
                    {a.isPrimary ? ' · Primary' : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {(hasMore || isFetchingMore) && (
            <div className="flex items-center justify-between mt-3">
              <span className="text-[11px] font-sans tabular-nums text-ink-soft">
                Showing {assignments.length} of {total} laws assigned
              </span>
              <button
                type="button"
                onClick={onLoadMore}
                disabled={isFetchingMore || !hasMore}
                className="px-3 h-7 border border-rule hover:border-ink text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isFetchingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
