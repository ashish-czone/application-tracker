import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { RequirePermission } from '@packages/rbac';
import { DashboardService } from './dashboard.service';

@Controller('projects-dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @RequirePermission('projects-dashboard.read')
  list() {
    return this.dashboard.listDashboard();
  }

  @Get(':id/summary')
  @RequirePermission('projects.read')
  summary(@Param('id', ParseUUIDPipe) id: string) {
    return this.dashboard.getProjectSummary(id);
  }
}
