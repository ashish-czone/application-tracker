import { registerDashboardWidget } from '@packages/dashboard-ui';
import { OverdueFilingsWidget } from './portals/customer/features/dashboard/widgets/OverdueFilingsWidget';

registerDashboardWidget({
  id: 'compliance.overdue-filings',
  title: 'Overdue filings',
  component: OverdueFilingsWidget,
  defaultSize: 'lg',
  requiredPermission: 'filings.read',
  category: 'Compliance',
});
