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
