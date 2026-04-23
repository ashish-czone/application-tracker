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

export const COMPLIANCE_FILING_GENERATED = 'compliance.ComplianceFilingGenerated' as const;

export interface ComplianceFilingGeneratedPayload extends Record<string, unknown> {
  ruleId: string;
  clientId: string;
  lawId: string;
  filingId: string;
  externalKey: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
}

/**
 * Emitted once per client dormancy cascade (Q6). Carries the full list of
 * filing ids that were auto-cancelled inside the transition tx so audit
 * consumers can render the cascade as a single high-level event rather than
 * flooding the audit stream with per-filing StatusChanged rows. Per-filing
 * workflow_history rows are still written inside the tx so each filing's own
 * detail/audit view shows "cancelled: Client dormantised".
 */
export const COMPLIANCE_CLIENT_DORMANTISED = 'compliance.ClientDormantised' as const;

export interface ComplianceClientDormantisedPayload extends Record<string, unknown> {
  clientId: string;
  clientName: string;
  reason: string | null;
  comment: string | null;
  cancelledFilingIds: string[];
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

export const CLIENT_REGISTRATIONS_CREATED = 'client-registrations.Created' as const;
export const CLIENT_REGISTRATIONS_DELETED = 'client-registrations.Deleted' as const;
