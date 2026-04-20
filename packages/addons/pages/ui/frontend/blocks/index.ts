import { blockRegistry } from '../registry';
import { heroBlock } from './Hero';
import { textBlock } from './TextBlock';
import { imageBlock } from './ImageBlock';
import { featureListBlock } from './FeatureList';
import { ctaBlock } from './CTA';

export const starterBlocks = [heroBlock, textBlock, imageBlock, featureListBlock, ctaBlock];

/**
 * Convenience for Next.js / admin bootstrapping: call once on app boot to
 * populate the registry with the starter set. Host apps typically also add
 * their own domain-specific blocks afterwards.
 */
export function registerStarterBlocks(): void {
  blockRegistry.registerAll(starterBlocks);
}

export { heroBlock, textBlock, imageBlock, featureListBlock, ctaBlock };
