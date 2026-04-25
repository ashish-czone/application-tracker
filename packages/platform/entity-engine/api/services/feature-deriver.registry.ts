import { Injectable } from '@nestjs/common';
import type { EntityConfig } from '../types';

/**
 * Function that inspects an entity config and returns a fragment to merge
 * into the registry entry's `features` bag. Returns an empty object when
 * the entity does not opt into the feature.
 */
export type FeatureDeriver = (config: EntityConfig) => Record<string, unknown>;

/**
 * Registry of feature-deriver functions contributed by feature packages
 * (workflows, taxonomy, media, ...). Each deriver inspects the entity
 * config and returns the bag fragment for its own opaque key. The engine
 * iterates the registry when serializing registry entries — it never
 * inspects the returned keys.
 *
 * Feature packages register their deriver in `onModuleInit()`.
 */
@Injectable()
export class FeatureDeriverRegistry {
  private readonly derivers: FeatureDeriver[] = [];

  register(deriver: FeatureDeriver): void {
    this.derivers.push(deriver);
  }

  derive(config: EntityConfig): Record<string, unknown> {
    return this.derivers.reduce<Record<string, unknown>>(
      (acc, deriver) => ({ ...acc, ...deriver(config) }),
      {},
    );
  }
}

/**
 * Module-level singleton — guarantees a single instance regardless of
 * NestJS module scoping. Mirrors `fieldTypeSaveHookRegistry`.
 */
export const featureDeriverRegistry = new FeatureDeriverRegistry();
