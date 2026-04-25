import { defineMapper } from '../registry';

export interface StatRecord {
  id: string;
  label: string;
  value: number;
  suffix: string | null;
}

export interface StatsRowFields extends Record<string, unknown> {
  stats: Array<{
    id: string;
    label: string;
    value: number;
    suffix: string | null;
  }>;
}

export const statsRowMapper = defineMapper<StatRecord, StatsRowFields>({
  entity: 'stats',
  block: 'stats-row',
  map: (records) => ({
    stats: records.map((r) => ({
      id: r.id,
      label: r.label,
      value: r.value,
      suffix: r.suffix,
    })),
  }),
});
