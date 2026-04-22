import { registerDashboardWidget } from '@packages/dashboard-ui';
import { OverdueFilingsWidget } from './portals/customer/features/dashboard/widgets/OverdueFilingsWidget';
import { UpcomingFilingsWidget } from './portals/customer/features/dashboard/widgets/UpcomingFilingsWidget';

registerDashboardWidget({
  id: 'compliance.overdue-filings',
  title: 'Overdue filings',
  component: OverdueFilingsWidget,
  defaultSize: 'lg',
  requiredPermission: 'filings.read',
  category: 'Compliance',
});

registerDashboardWidget({
  id: 'compliance.upcoming-filings',
  title: 'Upcoming filings',
  component: UpcomingFilingsWidget,
  defaultSize: 'md',
  requiredPermission: 'filings.read',
  category: 'Compliance',
});
