export { defineBlock, blockRegistry } from './registry';
export type { BlockRegistry } from './registry';
export type {
  BlockDefinition,
  BlockFieldSpec,
  BlockFieldType,
  BlockRenderProps,
  BlockVariant,
} from './types';

export {
  starterBlocks,
  registerStarterBlocks,
  heroBlock,
  textBlock,
  imageBlock,
  featureListBlock,
  ctaBlock,
} from './starter';

export {
  contentBlocks,
  registerContentBlocks,
  testimonialsGridBlock,
  faqAccordionBlock,
  teamGridBlock,
  servicesGridBlock,
  clientLogosRowBlock,
  valuePropsGridBlock,
  statsRowBlock,
} from './content';

export type { DataSource, SectionData, MapperDefinition } from '@domains/agency-contract';
