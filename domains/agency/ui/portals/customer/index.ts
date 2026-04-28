// Customer-portal entry: only exports surface needed by the public Next.js
// site so the RSC bundle does not transitively pull in admin client
// components (Puck editor, data-source picker, etc.).

export { PageRenderer } from './features/pages/PageRenderer';
export type { PageRendererProps } from './features/pages/PageRenderer';

export { MenuRenderer } from './features/menus/MenuRenderer';
export type { MenuRendererProps, MenuLinkComponent } from './features/menus/MenuRenderer';
export type {
  PublicMenuResponse,
  PublicMenuItemDto,
  PublicLinkType,
  PublicTarget,
} from './features/menus/types';

// Cross-portal block registry — the customer site populates it on boot so
// PageRenderer can look up each section's block definition.
export { defineBlock, blockRegistry } from '../../components/blocks/registry';
export type { BlockRegistry } from '../../components/blocks/registry';
export type {
  BlockDefinition,
  BlockFieldSpec,
  BlockFieldType,
  BlockRenderProps,
  BlockVariant,
} from '../../components/blocks/types';
export {
  starterBlocks,
  registerStarterBlocks,
  heroBlock,
  textBlock,
  imageBlock,
  featureListBlock,
  ctaBlock,
} from '../../components/blocks/starter';
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
} from '../../components/blocks/content';

export type { DataSource, SectionData, MapperDefinition } from '@domains/agency-contract';
