import { mapperRegistry } from '../registry';
import { testimonialsGridMapper } from './testimonials-grid';
import { faqAccordionMapper } from './faq-accordion';
import { teamGridMapper } from './team-grid';
import { servicesGridMapper } from './services-grid';
import { clientLogosRowMapper } from './client-logos-row';
import { valuePropsGridMapper } from './value-props-grid';
import { statsRowMapper } from './stats-row';

export { testimonialsGridMapper } from './testimonials-grid';
export { faqAccordionMapper } from './faq-accordion';
export { teamGridMapper } from './team-grid';
export { servicesGridMapper } from './services-grid';
export { clientLogosRowMapper } from './client-logos-row';
export { valuePropsGridMapper } from './value-props-grid';
export { statsRowMapper } from './stats-row';

export type {
  TestimonialRecord,
  TestimonialsGridFields,
} from './testimonials-grid';
export type { FaqItemRecord, FaqAccordionFields } from './faq-accordion';
export type { TeamMemberRecord, TeamGridFields } from './team-grid';
export type { ServiceRecord, ServicesGridFields } from './services-grid';
export type { ClientLogoRecord, ClientLogosRowFields } from './client-logos-row';
export type { ValuePropRecord, ValuePropsGridFields } from './value-props-grid';
export type { StatRecord, StatsRowFields } from './stats-row';

/**
 * All content-block mappers that ship with the platform, in a stable order.
 * Server addons that want only a subset can cherry-pick named exports; most
 * apps should just call `registerContentMappers()` at bootstrap.
 */
export const contentMappers = [
  testimonialsGridMapper,
  faqAccordionMapper,
  teamGridMapper,
  servicesGridMapper,
  clientLogosRowMapper,
  valuePropsGridMapper,
  statsRowMapper,
];

/**
 * Registers every content-block mapper against the singleton `mapperRegistry`.
 * Call once at server bootstrap (NestJS `AppModule` / `main.ts`) so the
 * pages public API can resolve section data sources for these (entity, block)
 * pairs without each app having to wire the registrations manually.
 */
export function registerContentMappers(): void {
  mapperRegistry.registerAll(contentMappers);
}
