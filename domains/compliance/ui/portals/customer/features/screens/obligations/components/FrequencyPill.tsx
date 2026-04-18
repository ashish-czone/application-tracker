import { Pill } from '../../../../../../components';
import type { ObligationFrequency } from '../data/obligationsMock';

export const FREQUENCY_LABEL: Record<ObligationFrequency, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  'half-yearly': 'Half-yearly',
  yearly: 'Yearly',
  event: 'On event',
  'ad-hoc': 'Ad-hoc',
};

export const FREQUENCY_OPTIONS: { value: ObligationFrequency; label: string }[] = (
  Object.keys(FREQUENCY_LABEL) as ObligationFrequency[]
).map((f) => ({ value: f, label: FREQUENCY_LABEL[f] }));

export interface FrequencyPillProps {
  frequency: ObligationFrequency;
}

export function FrequencyPill({ frequency }: FrequencyPillProps) {
  return <Pill>{FREQUENCY_LABEL[frequency]}</Pill>;
}
