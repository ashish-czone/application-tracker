import { useEffect, useState } from 'react';
import { ListTodo } from 'lucide-react';
import { tokenStore } from '../../../../shared/auth/services/tokenStore';

const API_BASE = (() => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
  return apiUrl.replace(/\/api\/v\d+\/?$/, '');
})();

const BULL_BOARD_URL = `${API_BASE}/admin/queues`;

export function QueuedTasksPage() {
  const [error, setError] = useState(false);

  useEffect(() => {
    const token = tokenStore.getAccessToken();
    if (token) {
      document.cookie = `bull_board_token=${token}; path=/admin/queues; max-age=3600; SameSite=Lax`;
    }

    return () => {
      document.cookie = 'bull_board_token=; path=/admin/queues; max-age=0';
    };
  }, []);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ListTodo className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold mb-1">Queue Dashboard Unavailable</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Could not load the queue dashboard. Make sure the API server is running and you have admin access.
        </p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] -m-4 lg:-m-6">
      <iframe
        src={BULL_BOARD_URL}
        className="w-full h-full border-0"
        title="Queue Dashboard"
        onError={() => setError(true)}
      />
    </div>
  );
}
