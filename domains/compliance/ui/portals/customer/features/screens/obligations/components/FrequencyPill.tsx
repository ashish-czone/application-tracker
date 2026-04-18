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
  return (
    <span className="inline-flex items-center px-2 py-[2px] border border-rule text-[10px] font-sans font-semibold uppercase tracking-[0.12em] text-ink-soft bg-paper-raised">
      {FREQUENCY_LABEL[frequency]}
    </span>
  );
}
