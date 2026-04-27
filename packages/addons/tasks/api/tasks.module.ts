import {
  Module,
  type DynamicModule,
  type ExistingProvider,
  type FactoryProvider,
  type ForwardReference,
  type ClassProvider,
  type OnModuleInit,
  type Type,
} from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { ActionRegistry } from '@packages/automation-contracts';
import { TASKS_CONFIG } from './tasks.config';
import { TasksService } from './services/tasks.service';
import { TaskClaimService } from './services/task-claim.service';
import { TaskActionsService } from './services/task-actions.service';
import { SendTaskDigestAction } from './services/send-task-digest.action';
import { TasksController } from './controllers/tasks.controller';
import { TaskClaimController } from './controllers/task-claim.controller';
import {
  TASK_TEAM_MEMBERS_READER,
  type TaskTeamMembersReader,
} from './task-team-members-reader.token';

type TeamMembersReaderBinding =
  | Omit<ExistingProvider<TaskTeamMembersReader>, 'provide'>
  | Omit<ClassProvider<TaskTeamMembersReader>, 'provide'>
  | Omit<FactoryProvider<TaskTeamMembersReader>, 'provide'>;

export interface TasksModuleOptions {
  /**
   * Modules whose exports the binding depends on (e.g. the app-level
   * OrgUnitsModule that exports OrgUnitService when using `useExisting`).
   */
  imports?: Array<Type<unknown> | DynamicModule | ForwardReference | Promise<DynamicModule>>;
  /**
   * Provider definition for `TASK_TEAM_MEMBERS_READER`. Apps typically wire
   * this via `useExisting: OrgUnitService` against their app-level
   * OrgUnitsModule.
   */
  teamMembersReader: TeamMembersReaderBinding;
}

@Module({})
export class TasksModule implements OnModuleInit {
  constructor(
    private readonly actionRegistry: ActionRegistry,
    private readonly sendTaskDigestAction: SendTaskDigestAction,
  ) {}

  static forRoot(options: TasksModuleOptions): DynamicModule {
    return {
      module: TasksModule,
      imports: [
        EntityEngineModule.forEntity(TASKS_CONFIG),
        ...(options.imports ?? []),
      ],
      controllers: [TasksController, TaskClaimController],
      providers: [
        TasksService,
        TaskClaimService,
        TaskActionsService,
        SendTaskDigestAction,
        { provide: TASK_TEAM_MEMBERS_READER, ...options.teamMembersReader } as
          | ExistingProvider
          | ClassProvider
          | FactoryProvider,
      ],
      exports: [TasksService],
    };
  }

  onModuleInit(): void {
    this.actionRegistry.register(this.sendTaskDigestAction);
  }
}
