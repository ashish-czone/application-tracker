export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  isRead: boolean;
  eventName: string | null;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
}
