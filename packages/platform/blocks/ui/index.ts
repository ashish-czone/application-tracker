export { defineBlock, blockRegistry } from './registry';
export type { BlockRegistry } from './registry';
export { PageRenderer } from './PageRenderer';
export type { PageRendererProps } from './PageRenderer';
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
} from './blocks';

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
} from './blocks/content';

// Re-export contract shapes consumers typically need alongside the UI bits.
export type { DataSource, SectionData, MapperDefinition } from '@packages/blocks-contract';
