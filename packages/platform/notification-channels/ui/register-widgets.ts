import { registerDashboardWidget } from '@packages/dashboard-ui';
import { RecentNotificationsWidget } from './components/RecentNotificationsWidget';

registerDashboardWidget({
  id: 'notifications.recent',
  title: 'Recent activity',
  component: RecentNotificationsWidget,
  defaultSize: 'sm',
  category: 'Communication',
});
