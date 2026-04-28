import { blockRegistry } from '../registry';
import { testimonialsGridBlock } from './TestimonialsGrid';
import { faqAccordionBlock } from './FaqAccordion';
import { teamGridBlock } from './TeamGrid';
import { servicesGridBlock } from './ServicesGrid';
import { clientLogosRowBlock } from './ClientLogosRow';
import { valuePropsGridBlock } from './ValuePropsGrid';
import { statsRowBlock } from './StatsRow';
import { awardsStripBlock } from './AwardsStrip';

export { testimonialsGridBlock } from './TestimonialsGrid';
export { faqAccordionBlock } from './FaqAccordion';
export { teamGridBlock } from './TeamGrid';
export { servicesGridBlock } from './ServicesGrid';
export { clientLogosRowBlock } from './ClientLogosRow';
export { valuePropsGridBlock } from './ValuePropsGrid';
export { statsRowBlock } from './StatsRow';
export { awardsStripBlock } from './AwardsStrip';

export const contentBlocks = [
  testimonialsGridBlock,
  faqAccordionBlock,
  teamGridBlock,
  servicesGridBlock,
  clientLogosRowBlock,
  valuePropsGridBlock,
  statsRowBlock,
  awardsStripBlock,
];

/**
 * Registers every content block against the singleton `blockRegistry`. Call
 * once at frontend boot (admin + customer) so the Puck editor and the public
 * renderer both know how to render these kinds.
 */
export function registerContentBlocks(): void {
  blockRegistry.registerAll(contentBlocks);
}
