import { defineMapper } from '../registry';

export interface ClientLogoRecord {
  id: string;
  name: string;
  logoUrl: string;
  href: string | null;
}

export interface ClientLogosRowFields extends Record<string, unknown> {
  logos: Array<{
    id: string;
    name: string;
    logoUrl: string;
    href: string | null;
  }>;
}

export const clientLogosRowMapper = defineMapper<ClientLogoRecord, ClientLogosRowFields>({
  entity: 'client-logos',
  block: 'client-logos-row',
  map: (records) => ({
    logos: records.map((r) => ({
      id: r.id,
      name: r.name,
      logoUrl: r.logoUrl,
      href: r.href,
    })),
  }),
});
