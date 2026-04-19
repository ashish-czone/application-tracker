export const FREQUENCIES = ['monthly', 'quarterly', 'half_yearly', 'yearly'] as const;
export type ComplianceFrequency = (typeof FREQUENCIES)[number];
