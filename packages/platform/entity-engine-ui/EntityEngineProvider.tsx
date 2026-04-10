import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createEntityApi } from './helpers/createEntityApi';
import { createEntityHooks, type EntityHooks } from './helpers/createEntityHooks';
import type { EntityRegistryEntry, EntityApi, EntityUIConfig, EntityDetailPlugin, DetailTabPlugin, RightSidebarPanel, ColumnRendererRegistration } from './types';

interface EntityEngineContextValue {
  /** All registered entities from the backend */
  entities: EntityRegistryEntry[];
  /** Whether the registry is still loading */
  isLoading: boolean;
  /** Get API client for an entity type */
  getApi: (entityType: string) => EntityApi | undefined;
  /** Get hooks for an entity type */
  getHooks: (entityType: string) => EntityHooks | undefined;
  /** Get registry entry for an entity type */
  getEntity: (entityType: string) => EntityRegistryEntry | undefined;
  /** Get entity by slug */
  getEntityBySlug: (slug: string) => EntityRegistryEntry | undefined;
  /** Get detail plugins for an entity type */
  getDetailPlugins: (entityType: string) => EntityDetailPlugin[];
  /** Get detail tab plugins for an entity type (global + entity-specific, sorted by order) */
  getDetailTabs: (entityType: string) => DetailTabPlugin[];
  /** Get right sidebar panels for an entity type (sorted by order) */
  getRightSidebarPanels: (entityType: string) => RightSidebarPanel[];
  /** Get a named column renderer registration */
  getColumnRenderer: (name: string) => ColumnRendererRegistration | undefined;
  /** Raw API client (for layout and other non-entity endpoints) */
  apiFn: EntityEngineProviderProps['apiFn'];
}

const EntityEngineContext = createContext<EntityEngineContextValue | null>(null);

interface EntityEngineProviderProps {
  children: ReactNode;
  /** The app's api object — must have get/post/patch/delete methods */
  apiFn: {
    get: <T>(path: string) => Promise<T>;
    post: <T>(path: string, body?: unknown) => Promise<T>;
    patch: <T>(path: string, body?: unknown) => Promise<T>;
    delete: <T>(path: string) => Promise<T>;
  };
  /** Frontend-side entity UI configs (detail plugins, etc.) */
  entityUIConfigs?: EntityUIConfig[];
  /** Global detail tab plugins (applied to all entity detail pages) */
  detailTabs?: DetailTabPlugin[];
  /** Named column renderer registrations (keyed by renderer name) */
  columnRenderers?: Record<string, ColumnRendererRegistration>;
  /** Global right sidebar panels (applied to all entity detail pages, filtered by featureFlag) */
  rightSidebarPanels?: RightSidebarPanel[];
}

export function EntityEngineProvider({ children, apiFn, entityUIConfigs = [], detailTabs: globalDetailTabs = [], rightSidebarPanels: globalSidebarPanels = [], columnRenderers = {} }: EntityEngineProviderProps) {
  // Fetch entity registry from backend
  const { data: entities = [], isLoading } = useQuery({
    queryKey: ['entity-engine', 'registry'],
    queryFn: () => apiFn.get<EntityRegistryEntry[]>('/entity-engine/registry'),
    staleTime: 5 * 60 * 1000, // registry rarely changes
  });

  // Build API clients and hooks per entity
  const { apiMap, hooksMap } = useMemo(() => {
    const apiMap = new Map<string, EntityApi>();
    const hooksMap = new Map<string, EntityHooks>();

    for (const entity of entities) {
      const api = createEntityApi(entity.slug, apiFn);
      apiMap.set(entity.entityType, api);
      hooksMap.set(entity.entityType, createEntityHooks(entity.entityType, entity.singularName, api));
    }

    return { apiMap, hooksMap };
  }, [entities, apiFn]);

  // Index UI configs by entity type
  const pluginMap = useMemo(() => {
    const map = new Map<string, EntityDetailPlugin[]>();
    for (const config of entityUIConfigs) {
      map.set(config.entityType, config.detailPlugins ?? []);
    }
    return map;
  }, [entityUIConfigs]);

  // Index detail tabs: global + per-entity, sorted by order
  const tabMap = useMemo(() => {
    const perEntity = new Map<string, DetailTabPlugin[]>();
    for (const config of entityUIConfigs) {
      if (config.detailTabs?.length) {
        perEntity.set(config.entityType, config.detailTabs);
      }
    }
    return perEntity;
  }, [entityUIConfigs]);

  // Index right sidebar panels by entity type
  const sidebarPanelMap = useMemo(() => {
    const map = new Map<string, RightSidebarPanel[]>();
    for (const config of entityUIConfigs) {
      if (config.rightSidebarPanels?.length) {
        map.set(config.entityType, [...config.rightSidebarPanels].sort((a, b) => a.order - b.order));
      }
    }
    return map;
  }, [entityUIConfigs]);

  const value = useMemo<EntityEngineContextValue>(() => ({
    entities,
    isLoading,
    getApi: (entityType: string) => apiMap.get(entityType),
    getHooks: (entityType: string) => hooksMap.get(entityType),
    getEntity: (entityType: string) => entities.find((e) => e.entityType === entityType),
    getEntityBySlug: (slug: string) => entities.find((e) => e.slug === slug),
    getDetailPlugins: (entityType: string) => pluginMap.get(entityType) ?? [],
    getDetailTabs: (entityType: string) => {
      const entityTabs = tabMap.get(entityType) ?? [];
      return [...globalDetailTabs, ...entityTabs].sort((a, b) => a.order - b.order);
    },
    getRightSidebarPanels: (entityType: string) => {
      const entityPanels = sidebarPanelMap.get(entityType) ?? [];
      return [...globalSidebarPanels, ...entityPanels].sort((a, b) => a.order - b.order);
    },
    getColumnRenderer: (name: string) => columnRenderers[name],
    apiFn,
  }), [entities, isLoading, apiMap, hooksMap, pluginMap, tabMap, sidebarPanelMap, globalDetailTabs, globalSidebarPanels, columnRenderers, apiFn]);

  if (isLoading) return null;

  return (
    <EntityEngineContext.Provider value={value}>
      {children}
    </EntityEngineContext.Provider>
  );
}

/** Access the entity engine context. Must be used within EntityEngineProvider. */
export function useEntityEngine(): EntityEngineContextValue {
  const ctx = useContext(EntityEngineContext);
  if (!ctx) throw new Error('useEntityEngine must be used within EntityEngineProvider');
  return ctx;
}

/** Get hooks for a specific entity type. */
export function useEntityHooks(entityType: string): EntityHooks {
  const { getHooks } = useEntityEngine();
  const hooks = getHooks(entityType);
  if (!hooks) throw new Error(`No hooks found for entity type "${entityType}". Is it registered?`);
  return hooks;
}

/** Get the registry entry for a specific entity type. */
export function useEntityConfig(entityType: string): EntityRegistryEntry {
  const { getEntity } = useEntityEngine();
  const entity = getEntity(entityType);
  if (!entity) throw new Error(`Entity type "${entityType}" not found in registry`);
  return entity;
}
