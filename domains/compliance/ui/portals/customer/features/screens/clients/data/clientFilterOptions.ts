import type { ClientRiskLevel } from './clientsMock';

export const HANDLER_OPTIONS: { value: string; label: string }[] = [
  { value: 'h1', label: 'Priya Shankar' },
  { value: 'h2', label: 'Arjun Mehta' },
  { value: 'h3', label: 'Kavita Rao' },
  { value: 'h4', label: 'Deepak Iyer' },
];

export const RISK_OPTIONS: { value: ClientRiskLevel; label: string }[] = [
  { value: 'healthy', label: 'Healthy' },
  { value: 'at-risk', label: 'At risk' },
  { value: 'critical', label: 'Critical' },
];
