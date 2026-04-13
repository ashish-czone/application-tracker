import type { Type } from '@nestjs/common';
import type { ComponentType } from 'react';
import type { RouteObject } from 'react-router';

export interface DomainBackendManifest {
  name: string;
  displayName: string;
  module: Type<unknown>;
}

/**
 * Detail page override component. Receives the entity record from EntityDetailPage.
 * Matches the EntityDetailPage shape so domain components can drop into the generic slot.
 */
export type DomainDetailPageComponent = ComponentType<Record<string, never>>;

export interface DomainWebManifest {
  name: string;
  displayName: string;
  /**
   * Routes mounted under the authenticated app shell.
   * Each route's element should be a React.lazy component so domain code is code-split.
   * On conflict with an existing path, the first-registered route wins.
   */
  routes?: RouteObject[];
  /**
   * Override the generic EntityDetailPage for specific entity types, keyed by entityType.
   * The override component is rendered in place of EntityDetailPage on `/{slug}/:id`.
   * On conflict, the first-registered domain wins.
   */
  detailPageOverrides?: Record<string, DomainDetailPageComponent>;
}
