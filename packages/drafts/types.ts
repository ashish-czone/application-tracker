export interface Draft {
  id: string;
  entityType: string;
  draftKey: string;
  data: unknown;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}
