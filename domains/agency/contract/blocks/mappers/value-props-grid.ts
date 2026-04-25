import { defineMapper } from '../registry';

export interface ValuePropRecord {
  id: string;
  title: string;
  description: string;
  iconName: string | null;
}

export interface ValuePropsGridFields extends Record<string, unknown> {
  items: Array<{
    id: string;
    title: string;
    description: string;
    iconName: string | null;
  }>;
}

export const valuePropsGridMapper = defineMapper<ValuePropRecord, ValuePropsGridFields>({
  entity: 'value-props',
  block: 'value-props-grid',
  map: (records) => ({
    items: records.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      iconName: r.iconName,
    })),
  }),
});
