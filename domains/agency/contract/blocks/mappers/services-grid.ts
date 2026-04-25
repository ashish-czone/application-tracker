import { defineMapper } from '../registry';

export interface ServiceRecord {
  id: string;
  name: string;
  description: string;
  iconName: string | null;
  ctaText: string | null;
  ctaHref: string | null;
}

export interface ServicesGridFields extends Record<string, unknown> {
  services: Array<{
    id: string;
    name: string;
    description: string;
    iconName: string | null;
    ctaText: string | null;
    ctaHref: string | null;
  }>;
}

export const servicesGridMapper = defineMapper<ServiceRecord, ServicesGridFields>({
  entity: 'services',
  block: 'services-grid',
  map: (records) => ({
    services: records.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      iconName: r.iconName,
      ctaText: r.ctaText,
      ctaHref: r.ctaHref,
    })),
  }),
});
