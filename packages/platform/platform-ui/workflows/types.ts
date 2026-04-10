export interface WorkflowState {
  id: string;
  name: string;
  label: string;
  color: string | null;
  sortOrder: number;
  metadata: Record<string, unknown> | null;
}

export interface WorkflowTransition {
  id: string;
  fromStateName: string;
  toStateName: string;
  name: string;
  requiredPermissions: string[];
  guardNames: string[];
  sortOrder: number;
  reasonOptions: string[] | null;
  reasonRequired: boolean;
  commentRequired: boolean;
  metadata: Record<string, unknown> | null;
}

export interface WorkflowDefinition {
  id: string;
  slug: string;
  name: string;
  entityType: string;
  fieldName: string;
  initialState: string;
  isActive: boolean;
  discriminatorKey: string | null;
  discriminatorValue: string | null;
  isDefault: boolean;
  states: WorkflowState[];
  transitions: WorkflowTransition[];
}

export interface CreateWorkflowRequest {
  slug: string;
  name: string;
  entityType: string;
  fieldName: string;
  initialState: string;
  discriminatorKey?: string;
  discriminatorValue?: string;
  isDefault?: boolean;
}

export interface UpdateWorkflowRequest {
  name?: string;
  entityType?: string;
  fieldName?: string;
  initialState?: string;
  isActive?: boolean;
}

export interface CreateStateRequest {
  name: string;
  label: string;
  color?: string;
  sortOrder?: number;
}

export interface UpdateStateRequest {
  name?: string;
  label?: string;
  color?: string | null;
  sortOrder?: number;
}

export interface CreateTransitionRequest {
  fromStateId: string;
  toStateId: string;
  name: string;
  requiredPermissions?: string[];
  guardNames?: string[];
  sortOrder?: number;
  reasonOptions?: string[];
  reasonRequired?: boolean;
  commentRequired?: boolean;
}

export interface UpdateTransitionRequest {
  name?: string;
  requiredPermissions?: string[] | null;
  guardNames?: string[] | null;
  sortOrder?: number;
  reasonOptions?: string[] | null;
  reasonRequired?: boolean;
  commentRequired?: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface TransitionHistoryEntry {
  id: string;
  workflowDefinitionId: string;
  entityType: string;
  entityId: string;
  fieldName: string;
  fromState: string;
  toState: string;
  transitionId: string | null;
  actorId: string | null;
  actorName: string | null;
  reason: string | null;
  comment: string | null;
  createdAt: string;
}
