import type { ClientRiskLevel } from '../data/clientsMock';

export const RISK_LABEL: Record<ClientRiskLevel, string> = {
  healthy: 'Healthy',
  'at-risk': 'At risk',
  critical: 'Critical',
};

const RISK_TONE: Record<ClientRiskLevel, string> = {
  healthy: 'bg-filed',
  'at-risk': 'bg-due-soon',
  critical: 'bg-signal',
};

export interface RiskPillProps {
  risk: ClientRiskLevel;
}

export function RiskPill({ risk }: RiskPillProps) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-[2px] border border-rule text-[10px] font-sans font-semibold uppercase tracking-[0.12em] bg-paper-raised">
      <span className={`w-1.5 h-1.5 flex-none ${RISK_TONE[risk]}`} aria-hidden />
      <span className="text-ink-soft">{RISK_LABEL[risk]}</span>
    </span>
  );
}
