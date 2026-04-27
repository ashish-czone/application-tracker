import { Pill } from '../../../../../components';
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
  return <Pill tone={RISK_TONE[risk]}>{RISK_LABEL[risk]}</Pill>;
}
