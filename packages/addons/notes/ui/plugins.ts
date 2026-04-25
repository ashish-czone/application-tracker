import type { DetailTabPlugin, RightSidebarPanel } from '@packages/entity-engine-ui';
import { NotesSection } from './components/NotesSection';
import { readNotesFeature } from './feature';

/**
 * Detail-page Notes tab. Apps spread this into `extraDetailTabs` on
 * `EntityEngineProvider`; it renders only on entities that opted in via
 * `notesFeature()` in their `defineEntity` config.
 */
export const notesDetailTab: DetailTabPlugin = {
  key: 'notes',
  label: 'Notes',
  order: 100,
  component: NotesSection,
  enabledFor: (entity) => !!readNotesFeature(entity.features),
};

/**
 * Right-sidebar Notes panel. Same gating as the tab.
 */
export const notesSidebarPanel: RightSidebarPanel = {
  key: 'notes',
  label: 'Notes',
  order: 100,
  component: NotesSection,
  enabledFor: (entity) => !!readNotesFeature(entity.features),
};
