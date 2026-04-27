// Frontend mirror of the backend response shapes. Defined here rather than
// imported from the api package so the UI bundle stays free of backend deps.

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed';
export type MilestoneStatus = 'pending' | 'in_progress' | 'completed';
export type FeatureStatus = 'backlog' | 'in_progress' | 'in_review' | 'done';
export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done';
export type Priority = 'low' | 'medium' | 'high';

export interface ProjectRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  ownerId: string | null;
  status: ProjectStatus;
  priority: Priority;
  color: string | null;
  icon: string | null;
  startDate: string | null;
  targetDate: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface MilestoneRecord {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  status: MilestoneStatus;
  dueDate: string | null;
  completedAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface FeatureRecord {
  id: string;
  milestoneId: string;
  name: string;
  description: string | null;
  status: FeatureStatus;
  priority: Priority;
  assigneeId: string | null;
  completedAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskRecord {
  id: string;
  featureId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assigneeId: string | null;
  dueDate: string | null;
  completedAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDashboardCard {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  ownerId: string | null;
  status: ProjectStatus;
  priority: Priority;
  color: string | null;
  icon: string | null;
  startDate: string | null;
  targetDate: string | null;
  taskCount: number;
  doneTaskCount: number;
  percentComplete: number;
  milestoneCount: number;
  overdueTaskCount: number;
}

export interface ProjectSummaryTask {
  id: string;
  title: string;
  status: TaskStatus;
  assigneeId: string | null;
  dueDate: string | null;
  sortOrder: number;
}

export interface ProjectSummaryFeature {
  id: string;
  name: string;
  status: FeatureStatus;
  priority: Priority;
  assigneeId: string | null;
  sortOrder: number;
  percentComplete: number;
  taskCount: number;
  doneTaskCount: number;
  tasks: ProjectSummaryTask[];
}

export interface ProjectSummaryMilestone {
  id: string;
  name: string;
  status: MilestoneStatus;
  dueDate: string | null;
  sortOrder: number;
  percentComplete: number;
  taskCount: number;
  doneTaskCount: number;
  features: ProjectSummaryFeature[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  ownerId: string | null;
  status: ProjectStatus;
  priority: Priority;
  color: string | null;
  icon: string | null;
  startDate: string | null;
  targetDate: string | null;
  percentComplete: number;
  taskCount: number;
  doneTaskCount: number;
  milestones: ProjectSummaryMilestone[];
}

export interface MyTaskRow {
  id: string;
  title: string;
  status: TaskStatus;
  dueDate: string | null;
  featureId: string;
  featureName: string;
  milestoneId: string;
  milestoneName: string;
  projectId: string;
  projectName: string;
  projectColor: string | null;
  projectIcon: string | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateProjectInput {
  name: string;
  slug: string;
  description?: string | null;
  ownerId?: string | null;
  priority?: Priority;
  color?: string | null;
  icon?: string | null;
  startDate?: string | null;
  targetDate?: string | null;
}

export interface CreateMilestoneInput {
  projectId: string;
  name: string;
  description?: string | null;
  dueDate?: string | null;
  sortOrder?: number;
}

export interface CreateFeatureInput {
  milestoneId: string;
  name: string;
  description?: string | null;
  assigneeId?: string | null;
  priority?: Priority;
  sortOrder?: number;
}

export interface CreateTaskInput {
  featureId: string;
  title: string;
  description?: string | null;
  assigneeId?: string | null;
  dueDate?: string | null;
  sortOrder?: number;
}
