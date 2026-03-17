import { Module, type OnModuleInit } from '@nestjs/common';
import { RbacService } from '@packages/rbac';
import { WorkflowsController } from './controllers/workflows.controller';

@Module({
  controllers: [WorkflowsController],
})
export class WorkflowsManagementModule implements OnModuleInit {
  constructor(private readonly rbacService: RbacService) {}

  onModuleInit() {
    this.rbacService.registerPermissions('workflows', [
      { action: 'read', description: 'View workflow definitions' },
      { action: 'manage', description: 'Create, update, and delete workflow definitions, states, and transitions' },
    ]);
  }
}
