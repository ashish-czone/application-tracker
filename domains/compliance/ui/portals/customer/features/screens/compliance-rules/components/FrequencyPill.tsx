import { FREQUENCIES, type ComplianceFrequency } from '@domains/compliance-contract';
import { Pill } from '../../../../../../components';

export const FREQUENCY_LABEL: Record<ComplianceFrequency, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  half_yearly: 'Half-yearly',
  yearly: 'Yearly',
};

export const FREQUENCY_OPTIONS: { value: ComplianceFrequency; label: string }[] =
  FREQUENCIES.map((f) => ({ value: f, label: FREQUENCY_LABEL[f] }));

export interface FrequencyPillProps {
  frequency: ComplianceFrequency;
}

export function FrequencyPill({ frequency }: FrequencyPillProps) {
  return <Pill>{FREQUENCY_LABEL[frequency]}</Pill>;
}
