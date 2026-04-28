import type { ClientRiskLevel } from './types';

export const RISK_OPTIONS: { value: ClientRiskLevel; label: string }[] = [
  { value: 'healthy', label: 'Healthy' },
  { value: 'at-risk', label: 'At risk' },
  { value: 'critical', label: 'Critical' },
];
