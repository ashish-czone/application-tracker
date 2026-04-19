import { Pill } from '../../../../../../components';
import type { ComplianceRuleFrequency } from '../data/complianceRulesMock';

export const FREQUENCY_LABEL: Record<ComplianceRuleFrequency, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  'half-yearly': 'Half-yearly',
  yearly: 'Yearly',
  event: 'On event',
  'ad-hoc': 'Ad-hoc',
};

export const FREQUENCY_OPTIONS: { value: ComplianceRuleFrequency; label: string }[] = (
  Object.keys(FREQUENCY_LABEL) as ComplianceRuleFrequency[]
).map((f) => ({ value: f, label: FREQUENCY_LABEL[f] }));

export interface FrequencyPillProps {
  frequency: ComplianceRuleFrequency;
}

export function FrequencyPill({ frequency }: FrequencyPillProps) {
  return <Pill>{FREQUENCY_LABEL[frequency]}</Pill>;
}
