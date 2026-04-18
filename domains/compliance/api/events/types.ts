export const COMPLIANCE_TASK_GENERATED = 'compliance.ComplianceTaskGenerated' as const;

export interface ComplianceTaskGeneratedPayload extends Record<string, unknown> {
  ruleId: string;
  clientId: string;
  lawId: string;
  taskId: string;
  externalKey: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
}

// Names mirror the dynamic events entity-engine emits for generic CRUD paths,
// so listeners (audit, automations, etc.) subscribe once and receive events
// from both the auto-CRUD and the custom create-with-contacts / primary-flip
// endpoints.
export const CLIENTS_CREATED = 'clients.Created' as const;
export const CLIENTS_UPDATED = 'clients.Updated' as const;
export const CLIENTS_DELETED = 'clients.Deleted' as const;

export const CLIENT_CONTACTS_CREATED = 'client-contacts.Created' as const;
export const CLIENT_CONTACTS_UPDATED = 'client-contacts.Updated' as const;
export const CLIENT_CONTACTS_DELETED = 'client-contacts.Deleted' as const;
