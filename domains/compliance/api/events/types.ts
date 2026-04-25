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

/**
 * Emitted when a client_registration is deactivated (I4/I5, Q8). Medium
 * destructive: cancels non-terminal filings whose `periodStart > deactivatedAt`
 * inside the same tx. If the admin opts in via `alsoCancelEarlier`, filings
 * for earlier periods are cancelled too, tagged with a distinct reason so the
 * audit trail reconstructs intent. `autoCancelledFilingIds` and
 * `manuallyCancelledFilingIds` are reported separately so downstream listeners
 * can distinguish the two paths — e.g. automations that fire on "client was
 * actively downscoped" should probably only react to the manual path.
 */
export const COMPLIANCE_REGISTRATION_DEACTIVATED = 'compliance.RegistrationDeactivated' as const;

export interface ComplianceRegistrationDeactivatedPayload extends Record<string, unknown> {
  registrationId: string;
  clientId: string;
  lawId: string;
  deactivatedAt: string;
  comment: string | null;
  autoCancelledFilingIds: string[];
  manuallyCancelledFilingIds: string[];
}
