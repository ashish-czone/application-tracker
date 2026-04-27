// Names mirror the dynamic events entity-engine emits for generic CRUD paths,
// so listeners (audit, automations, etc.) subscribe once and receive events
// from both the auto-CRUD and any custom endpoints we add later.
export const PROJECTS_CREATED = 'projects.Created' as const;
export const PROJECTS_UPDATED = 'projects.Updated' as const;
export const PROJECTS_DELETED = 'projects.Deleted' as const;

export const MILESTONES_CREATED = 'milestones.Created' as const;
export const MILESTONES_UPDATED = 'milestones.Updated' as const;
export const MILESTONES_DELETED = 'milestones.Deleted' as const;

export const FEATURES_CREATED = 'features.Created' as const;
export const FEATURES_UPDATED = 'features.Updated' as const;
export const FEATURES_DELETED = 'features.Deleted' as const;

export const TASKS_CREATED = 'tasks.Created' as const;
export const TASKS_UPDATED = 'tasks.Updated' as const;
export const TASKS_DELETED = 'tasks.Deleted' as const;
