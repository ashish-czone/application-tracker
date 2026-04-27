import { apiClient } from './api-client';

export interface RecipientNotification {
  id: string;
  title: string;
  body: string;
  eventName: string | null;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  createdAt: string;
}

/**
 * Lists notifications for any user via the test-hooks endpoint. The
 * production `GET /notifications` is scoped to the calling user; this
 * helper bypasses that scope so an e2e spec authenticated as the e2e
 * admin can assert that *Alice* and *Bob* received the notifications a
 * digest or escalation rule was supposed to dispatch to them.
 *
 * Requires `ENABLE_TEST_HOOKS=true` on the API.
 */
export async function listNotificationsFor(userId: string): Promise<RecipientNotification[]> {
  const result = await apiClient.get<{ notifications: RecipientNotification[] }>(
    `/admin/test/notifications?userId=${encodeURIComponent(userId)}`,
  );
  return result.notifications;
}
