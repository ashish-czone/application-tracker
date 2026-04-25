import { defineMapper } from '../registry';

export interface TestimonialRecord {
  id: string;
  quote: string;
  authorName: string;
  authorRole: string | null;
  companyName: string | null;
  avatarUrl: string | null;
  companyLogoUrl: string | null;
}

export interface TestimonialsGridFields extends Record<string, unknown> {
  items: Array<{
    id: string;
    quote: string;
    authorName: string;
    authorRole: string | null;
    companyName: string | null;
    avatarUrl: string | null;
    companyLogoUrl: string | null;
  }>;
}

export const testimonialsGridMapper = defineMapper<TestimonialRecord, TestimonialsGridFields>({
  entity: 'testimonials',
  block: 'testimonials-grid',
  map: (records) => ({
    items: records.map((r) => ({
      id: r.id,
      quote: r.quote,
      authorName: r.authorName,
      authorRole: r.authorRole,
      companyName: r.companyName,
      avatarUrl: r.avatarUrl,
      companyLogoUrl: r.companyLogoUrl,
    })),
  }),
});
