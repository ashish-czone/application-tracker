import { Module, type OnModuleInit, Optional, Inject } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { RbacService, UserRolesRelationHandler } from '@packages/rbac';
import { CredentialsRelationHandler } from '@packages/auth';
import { users, isNull } from '@packages/database';
import { ContactResolverRegistry } from '@packages/notifications';
import { LookupResolverService } from '@packages/entity-engine';
import { UsersController } from './controllers/users.controller';
import { UsersService } from './services/users.service';
import {
  createUsersEntityConfig,
  type UsersRolesReader,
  type UsersPositionsReader,
} from './users.config';

/** Token for optional UniqueCheckService injection from app-level SharedModule */
export const UNIQUE_CHECK_SERVICE = 'UNIQUE_CHECK_SERVICE';

/** DI token for the optional positions reader. Apps that have an org-units
 *  membership concept register a provider for this token; apps that don't
 *  just leave it unbound and every user row gets `positions: []`. */
export const USERS_POSITIONS_READER = 'USERS_POSITIONS_READER';

/**
 * Module-level entity config. Built once at module-definition time with
 * placeholder handlers and late-bound reader closures so
 * `EntityEngineModule.forEntity()` receives a stable reference. The handlers
 * live on singletons from `@packages/auth` and `@packages/rbac` that are only
 * available after DI has run, so they're swapped in at `onModuleInit`; the
 * readers are late-bound through module-scoped refs that the closures below
 * read from every call.
 *
 * The engine reads handlers and hooks at request time (not at bootstrap), so
 * the late-binding is safe: every entity request fires after onModuleInit.
 */
let rbacRef: RbacService | null = null;
let positionsRef: UsersPositionsReader | null = null;

const rolesReader: UsersRolesReader = {
  getRolesByUserIds: async (ids) => (rbacRef ? rbacRef.getRolesByUserIds(ids) : {}),
};

const positionsReader: UsersPositionsReader = {
  getPositionsByUserIds: async (ids) =>
    positionsRef ? positionsRef.getPositionsByUserIds(ids) : {},
};

const USERS_CONFIG = createUsersEntityConfig({
  credentialsHandler: {} as any,
  rolesHandler: {} as any,
  rolesReader,
  positionsReader,
});

@Module({
  imports: [EntityEngineModule.forEntity(USERS_CONFIG, { controller: 'none' })],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule implements OnModuleInit {
  constructor(
    private readonly rbacService: RbacService,
    private readonly contactResolverRegistry: ContactResolverRegistry,
    private readonly usersService: UsersService,
    private readonly lookupResolver: LookupResolverService,
    private readonly credentialsHandler: CredentialsRelationHandler,
    private readonly rolesHandler: UserRolesRelationHandler,
    @Optional() @Inject(UNIQUE_CHECK_SERVICE) private readonly uniqueCheckService?: any,
    @Optional()
    @Inject(USERS_POSITIONS_READER)
    private readonly appPositionsReader?: UsersPositionsReader,
  ) {}

  onModuleInit() {
    // Late-bind the runtime-injected dependencies into the entity config. The
    // config object was created at module-definition time with placeholders;
    // the engine reads these at request time, so mutation here is visible to
    // every subsequent CRUD call.
    const credsRel = USERS_CONFIG.relationships!.find((r) => r.name === 'credentials')!;
    credsRel.handler = this.credentialsHandler;
    const rolesRel = USERS_CONFIG.relationships!.find((r) => r.name === 'roles')!;
    rolesRel.handler = this.rolesHandler;

    rbacRef = this.rbacService;
    if (this.appPositionsReader) positionsRef = this.appPositionsReader;

    // Contact resolvers for notification channels — not covered by entity-engine
    this.contactResolverRegistry.register('email', (userId) => this.usersService.getEmail(userId));
    this.contactResolverRegistry.register('whatsapp', (userId) => this.usersService.getPhone(userId));

    // Register users as a lookup entity for user/multi_user field filters
    this.lookupResolver.register({
      entity: 'users',
      table: users,
      labelField: 'firstName',
      labelFields: ['firstName', 'lastName'],
      valueField: 'id',
      searchFields: ['firstName', 'lastName', 'email'],
    });

    // Unique-field registration for the app-level unique check (if provided)
    if (this.uniqueCheckService) {
      this.uniqueCheckService.register('users', {
        table: users,
        idColumn: users.id,
        readPermission: 'users.read',
        fields: {
          email: { column: users.email, extraCondition: isNull(users.deletedAt) },
        },
      });
    }

    // Permissions, audit event registration, and domain event registration
    // are all handled by EntityEngineModule.forEntity() during
    // onApplicationBootstrap. No manual registration needed here.
  }
}
