import { useMemo, useState } from 'react';
import { Building2, ChevronRight, Plus, MoreHorizontal, Shield, Users, AlertTriangle } from 'lucide-react';
import { Eyebrow, CoarseTabs, type CoarseTabItem } from '@packages/ui';
import {
  LEVEL_META,
  POSITION_LABEL,
  buildBreadcrumb,
  getUnitMembers,
  getUnitHead,
  getUnitChildren,
  getUnitLawAssignments,
  type OrgUnit,
  type OrgMember,
  type ComplianceLawAssignment,
  type HealthStatus,
} from '../data/orgHierarchyMock';

// ─── Health badge ───────────────────────────────────────────────────

const HEALTH_STYLE: Record<HealthStatus, { bg: string; text: string; label: string }> = {
  healthy: { bg: 'bg-filed/10', text: 'text-filed', label: 'Healthy' },
  'at-risk': { bg: 'bg-due-soon/10', text: 'text-due-soon', label: 'At Risk' },
  critical: { bg: 'bg-signal/10', text: 'text-signal', label: 'Critical' },
};

// ─── Tabs ───────────────────────────────────────────────────────────

type DetailTab = 'members' | 'sub-units' | 'compliance';

const TABS: CoarseTabItem<DetailTab>[] = [
  { value: 'members', label: 'Members' },
  { value: 'sub-units', label: 'Sub Units' },
  { value: 'compliance', label: 'Compliance' },
];

// ─── Component ──────────────────────────────────────────────────────

interface UnitDetailPanelProps {
  unit: OrgUnit;
  allUnits: OrgUnit[];
  allMembers: OrgMember[];
  allAssignments: ComplianceLawAssignment[];
  onAddMember?: () => void;
}

export function UnitDetailPanel({
  unit,
  allUnits,
  allMembers,
  allAssignments,
  onAddMember,
}: UnitDetailPanelProps) {
  const [tab, setTab] = useState<DetailTab>('members');

  const breadcrumb = useMemo(() => buildBreadcrumb(allUnits, unit.id), [allUnits, unit.id]);
  const members = useMemo(() => getUnitMembers(allMembers, unit.id), [allMembers, unit.id]);
  const head = useMemo(() => getUnitHead(allMembers, unit.headId), [allMembers, unit.headId]);
  const children = useMemo(() => getUnitChildren(allUnits, unit.id), [allUnits, unit.id]);
  const lawAssignments = useMemo(
    () => getUnitLawAssignments(allAssignments, unit.id),
    [allAssignments, unit.id],
  );
  const levelMeta = LEVEL_META[unit.level];
  const healthStyle = HEALTH_STYLE[unit.health];

  const tabsWithCount: CoarseTabItem<DetailTab>[] = TABS.map((t) => {
    if (t.value === 'members') return { ...t, count: members.length };
    if (t.value === 'sub-units') return { ...t, count: children.length };
    if (t.value === 'compliance') return { ...t, count: lawAssignments.length };
    return t;
  });

  return (
    <div className="h-full flex flex-col">
      {/* ─── Header ────────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-0">
        {/* Breadcrumb */}
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

        {/* Title row */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-serif text-2xl text-ink leading-none">{unit.name}</h2>
              <span className={`px-1.5 py-0.5 text-[9px] uppercase tracking-eyebrow font-sans font-semibold ${levelMeta.color}`}>
                {levelMeta.label}
              </span>
              <span className={`px-2 py-0.5 text-[9px] uppercase tracking-eyebrow font-sans font-semibold ${healthStyle.bg} ${healthStyle.text}`}>
                {healthStyle.label}
              </span>
            </div>
            <p className="mt-1.5 font-mono text-[11px] text-ink-muted tracking-wide">{unit.code}</p>
          </div>
          <button
            type="button"
            className="w-8 h-8 flex items-center justify-center border border-rule hover:border-ink text-ink-muted hover:text-ink transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Quick stats row */}
        <div className="flex items-center gap-6 mt-4 pb-4 border-b border-rule">
          {head && (
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 bg-authority text-paper text-[9px] font-sans font-semibold flex items-center justify-center">
                {head.initials}
              </span>
              <div>
                <div className="text-[11px] font-sans text-ink leading-none">{head.name}</div>
                <div className="text-[9px] uppercase tracking-eyebrow text-ink-muted font-sans mt-0.5">Head</div>
              </div>
            </div>
          )}
          {!head && (
            <div className="flex items-center gap-2 text-ink-muted">
              <span className="w-6 h-6 border border-rule border-dashed text-[9px] font-sans flex items-center justify-center">?</span>
              <span className="text-[10px] italic font-sans">No head assigned</span>
            </div>
          )}
          <div className="h-4 border-l border-rule" />
          <div className="text-[11px] font-sans text-ink-muted">
            <span className="text-ink font-medium">{members.length}</span> members
          </div>
          {children.length > 0 && (
            <>
              <div className="h-4 border-l border-rule" />
              <div className="text-[11px] font-sans text-ink-muted">
                <span className="text-ink font-medium">{children.length}</span> sub-units
              </div>
            </>
          )}
          {lawAssignments.length > 0 && (
            <>
              <div className="h-4 border-l border-rule" />
              <div className="text-[11px] font-sans text-ink-muted">
                <span className="text-ink font-medium">{lawAssignments.length}</span> laws assigned
              </div>
            </>
          )}
        </div>

        {/* Tabs */}
        <div className="mt-0">
          <CoarseTabs tabs={tabsWithCount} value={tab} onChange={setTab} animated />
        </div>
      </div>

      {/* ─── Tab content ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {tab === 'sub-units' && (
          <SubUnitsTab unit={unit} children={children} allMembers={allMembers} />
        )}
        {tab === 'members' && (
          <MembersTab members={members} onAddMember={onAddMember} />
        )}
        {tab === 'compliance' && (
          <ComplianceTab assignments={lawAssignments} />
        )}
      </div>
    </div>
  );
}

// ─── Overview tab ───────────────────────────────────────────────────

function SubUnitsTab({
  unit,
  children,
  allMembers,
}: {
  unit: OrgUnit;
  children: OrgUnit[];
  allMembers: OrgMember[];
}) {
  return (
    <div className="space-y-6">
      <div>
        <Eyebrow tone="muted">Description</Eyebrow>
        <p className="mt-2 font-serif text-[14px] text-ink leading-relaxed italic">
          {unit.description}
        </p>
      </div>

      {children.length > 0 ? (
        <div>
          <Eyebrow tone="muted">Sub-units</Eyebrow>
          <div className="mt-2 space-y-1">
            {children.map((child) => {
              const childMembers = getUnitMembers(allMembers, child.id);
              const childHead = getUnitHead(allMembers, child.headId);
              const healthStyle = HEALTH_STYLE[child.health];
              return (
                <div
                  key={child.id}
                  className="flex items-center gap-3 px-3 py-2.5 border border-rule hover:border-ink-muted transition-colors"
                >
                  <span className={`w-2 h-2 rounded-full ${healthStyle.bg.replace('/10', '')}`} />
                  <span className="font-mono text-[10px] tracking-wider text-ink-muted w-8">{child.code}</span>
                  <span className="font-sans text-[13px] text-ink flex-1">{child.name}</span>
                  {childHead && (
                    <span className="w-5 h-5 bg-ink-muted text-paper text-[8px] font-sans font-semibold flex items-center justify-center" title={childHead.name}>
                      {childHead.initials}
                    </span>
                  )}
                  <span className="text-[10px] font-mono tabular-nums text-ink-muted">
                    {childMembers.length} members
                  </span>
                </div>
              );
            })}
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

// ─── Members tab ────────────────────────────────────────────────────

function MembersTab({ members, onAddMember }: { members: OrgMember[]; onAddMember?: () => void }) {
  const sorted = useMemo(() => {
    const order: Record<string, number> = { head: 0, manager: 1, senior: 2, executive: 3 };
    return [...members].sort((a, b) => (order[a.position] ?? 9) - (order[b.position] ?? 9));
  }, [members]);

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

      {sorted.length === 0 ? (
        <div className="py-12 text-center">
          <Users className="w-8 h-8 text-ink-muted/40 mx-auto mb-3" strokeWidth={1} />
          <p className="font-serif italic text-ink-muted text-sm">No members assigned</p>
          <p className="text-[10px] text-ink-muted/70 font-sans mt-1">
            Add team members to this organisational unit.
          </p>
        </div>
      ) : (
        <div className="border border-rule divide-y divide-rule">
          {sorted.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-paper-sunken/30 transition-colors"
            >
              <span className="w-7 h-7 bg-ink text-paper text-[10px] font-sans font-semibold flex items-center justify-center shrink-0">
                {member.initials}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-sans text-ink leading-none">{member.name}</div>
                <div className="text-[11px] text-ink-muted font-sans mt-0.5">{member.email}</div>
              </div>
              <span className="px-2 py-0.5 text-[9px] uppercase tracking-eyebrow font-sans font-semibold bg-paper-sunken text-ink-muted">
                {POSITION_LABEL[member.position]}
              </span>
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

// ─── Compliance tab ─────────────────────────────────────────────────

function ComplianceTab({ assignments }: { assignments: ComplianceLawAssignment[] }) {
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

      {assignments.length === 0 ? (
        <div className="py-12 text-center">
          <Shield className="w-8 h-8 text-ink-muted/40 mx-auto mb-3" strokeWidth={1} />
          <p className="font-serif italic text-ink-muted text-sm">No laws assigned</p>
          <p className="text-[10px] text-ink-muted/70 font-sans mt-1">
            Assign compliance laws to make this unit responsible for their obligations.
          </p>
        </div>
      ) : (
        <div className="border border-rule divide-y divide-rule">
          {assignments.map((a) => {
            const pct = a.totalObligations > 0
              ? Math.round((a.compliant / a.totalObligations) * 100)
              : 0;
            const hasOverdue = a.overdue > 0;
            return (
              <div
                key={a.id}
                className="flex items-center gap-4 px-4 py-3 hover:bg-paper-sunken/30 transition-colors"
              >
                <span className="font-mono text-[11px] tracking-wider text-ink-muted w-10 shrink-0">
                  {a.lawCode}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-sans text-ink leading-none truncate">{a.lawName}</div>
                  <div className="text-[10px] text-ink-muted font-sans mt-1">
                    {a.totalObligations} obligations · {a.compliant} compliant
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-20 h-1.5 bg-paper-sunken rounded-full overflow-hidden">
                  <div
                    className={`h-full ${hasOverdue ? 'bg-signal' : 'bg-filed'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className={`font-mono tabular-nums text-[11px] w-10 text-right ${
                  hasOverdue ? 'text-signal font-medium' : 'text-ink-muted'
                }`}>
                  {pct}%
                </span>

                {hasOverdue && (
                  <span className="flex items-center gap-1 text-[10px] text-signal font-sans">
                    <AlertTriangle className="w-3 h-3" strokeWidth={2} />
                    {a.overdue}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
