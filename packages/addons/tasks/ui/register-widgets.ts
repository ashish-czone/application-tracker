import { registerDashboardWidget } from '@packages/dashboard-ui';
import { MyTasksWidget } from './components/MyTasksWidget';

registerDashboardWidget({
  id: 'tasks.my-tasks',
  title: 'My tasks',
  component: MyTasksWidget,
  defaultSize: 'md',
  requiredPermission: 'tasks.read',
  category: 'Work',
});
