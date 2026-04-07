import type { ComponentType } from 'react';
import type { PaginatedResponse } from '@packages/common';

/** Matches EntityRegistryEntry from the backend */
export interface EntityRegistryEntry {
  entityType: string;
  singularName: string;
  pluralName: string;
  slug: string;
  ui: {
    icon: string;
    nameField: string | string[];
    subtitleField?: string;
    navGroup?: string;
    navOrder?: number;
    createMode?: 'modal' | 'page' | 'wizard';
    boardFields?: string[];
  };
  features: {
    softDelete: boolean;
    restore: boolean;
    hasTaxonomy: boolean;
    hasWorkflow: boolean;
    hasMedia: boolean;
    hasNotes: boolean;
    hasAttachments: boolean;
    hasEvaluations: boolean;
    workflowDiscriminator?: {
      key: string;
      label: string;
      options: { value: string; label: string }[];
      fieldName: string;
    } | null;
  };
  relationships: {
    name: string;
    type: 'hasMany' | 'belongsTo' | 'manyToMany';
    targetEntity: string;
    foreignKey?: string;
    label: string;
    displayFields?: string[];
  }[];
}

/** API client for a single entity */
export interface EntityApi {
  list: (params: Record<string, unknown>) => Promise<PaginatedResponse<Record<string, unknown>>>;
  get: (id: string) => Promise<Record<string, unknown>>;
  create: (data: Record<string, unknown>) => Promise<Record<string, unknown>>;
  update: (id: string, data: Record<string, unknown>) => Promise<Record<string, unknown>>;
  delete: (id: string) => Promise<void>;
  restore: (id: string) => Promise<Record<string, unknown>>;
  clone: (id: string) => Promise<Record<string, unknown>>;
}

/** Plugin section rendered on entity detail page */
export interface EntityDetailPlugin {
  component: ComponentType<{ entity: Record<string, unknown> }>;
  label: string;
  order: number;
}

/** Frontend-side entity UI config (supplements the backend registry) */
export interface EntityUIConfig {
  entityType: string;
  detailPlugins?: EntityDetailPlugin[];
}

/** Registration for a named cell renderer used in list view columns */
export interface ColumnRendererRegistration {
  component: ComponentType<{ value: unknown; row: Record<string, unknown>; entityType: string }>;
}
