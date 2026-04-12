export interface UserPreference {
  id: string;
  userId: string;
  namespace: string;
  key: string;
  value: unknown;
  createdAt: Date;
  updatedAt: Date;
}
