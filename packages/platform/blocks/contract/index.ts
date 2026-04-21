export { defineMapper, mapperRegistry } from './registry';
export type { MapperRegistry } from './registry';
export type { DataSource, MapperDefinition, SectionData } from './types';
export {
  contentMappers,
  registerContentMappers,
  testimonialsGridMapper,
  faqAccordionMapper,
  teamGridMapper,
  servicesGridMapper,
  clientLogosRowMapper,
  valuePropsGridMapper,
  statsRowMapper,
} from './mappers';
export type {
  TestimonialRecord,
  TestimonialsGridFields,
  FaqItemRecord,
  FaqAccordionFields,
  TeamMemberRecord,
  TeamGridFields,
  ServiceRecord,
  ServicesGridFields,
  ClientLogoRecord,
  ClientLogosRowFields,
  ValuePropRecord,
  ValuePropsGridFields,
  StatRecord,
  StatsRowFields,
} from './mappers';
