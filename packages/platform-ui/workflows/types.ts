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
  states: WorkflowState[];
  transitions: WorkflowTransition[];
}

export interface CreateWorkflowRequest {
  slug: string;
  name: string;
  entityType: string;
  fieldName: string;
  initialState: string;
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
}

export interface UpdateTransitionRequest {
  name?: string;
  requiredPermissions?: string[] | null;
  guardNames?: string[] | null;
  sortOrder?: number;
  metadata?: Record<string, unknown> | null;
}
