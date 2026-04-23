import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Inject,
  Optional,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser, type JwtPayload } from '@packages/auth';
import { RequirePermission } from '@packages/rbac';
import { EntityService } from './entity.service';
import { createFieldPermissionInterceptor } from './interceptors/field-permission.interceptor';
import type { EntityConfig, ListLayoutResponse, EntityActions, DataAccessContext, AccessScopeSpec, PositionScopeProvider } from './types';

type JwtPermissionValue = AccessScopeSpec[] | true;

/**
 * Builds the data access context for a verb from the user's JWT. Scopes are
 * attached to the role-permission grant; the JWT carries them as
 * `permissions[<name>]: ScopeSpec[]`. Wildcard `*` collapses to `[{type:'any'}]`.
 *
 * Returns `undefined` when the user holds no grant for the permission — the
 * upstream @RequirePermission guard rejects that case first, so the access
 * context is only built for authorised callers.
 *
 * `entityType` and `positionScopeProvider` are retained in the signature for
 * call-site stability; they are no longer used to resolve scope.
 */
export function buildAccessContext(
  user: JwtPayload,
  permission: string,
  _entityType: string,
  _positionScopeProvider: PositionScopeProvider | null,
): DataAccessContext | undefined {
  const permissions = (user as { permissions?: Record<string, JwtPermissionValue> }).permissions;
  if (!permissions) return undefined;

  // Wildcard → unrestricted on every verb.
  if ('*' in permissions) return { userId: user.userId, scopes: [{ type: 'any' }] };

  const value = permissions[permission];
  if (value === undefined) return undefined;

  // Legacy boolean grant (pre-scope) → treated as unrestricted.
  if (value === true) return { userId: user.userId, scopes: [{ type: 'any' }] };

  // Empty array means the user has the grant but no scopes resolved — deny.
  return { userId: user.userId, scopes: value };
}

/**
 * Creates a NestJS controller class dynamically for an entity.
 *
 * Generates standard REST routes:
 * - GET    /{slug}            → list
 * - GET    /{slug}/:id        → findOne
 * - POST   /{slug}            → create
 * - PATCH  /{slug}/:id        → update
 * - DELETE /{slug}/:id        → softDelete
 * - POST   /{slug}/:id/transition → workflow state transition
 * - POST   /{slug}/:id/restore → restore
 *
 * Each route is guarded by @RequirePermission using the entity's slug.
 */
export function createEntityController(config: EntityConfig, serviceToken: string): any {
  const readPermission = `${config.slug}.read`;
  const createPermission = `${config.slug}.create`;
  const updatePermission = `${config.slug}.update`;
  const deletePermission = `${config.slug}.delete`;

  const FieldPermissionInterceptor = createFieldPermissionInterceptor(config);

  const POSITION_SCOPE_TOKEN = 'POSITION_SCOPE_PROVIDER';

  @ApiTags(config.slug)
  @Controller(config.slug)
  @UseInterceptors(FieldPermissionInterceptor)
  class DynamicEntityController {
    private readonly positionScopeProvider: PositionScopeProvider | null;

    constructor(
      @Inject(serviceToken) private readonly entityService: EntityService,
      @Inject(POSITION_SCOPE_TOKEN) @Optional() positionScopeProvider: PositionScopeProvider | null,
    ) {
      this.positionScopeProvider = positionScopeProvider ?? null;
    }

    @Get('layout/list')
    @RequirePermission(readPermission)
    @ApiOperation({ summary: `Get list layout config for ${config.pluralName.toLowerCase()}` })
    async getListLayout(): Promise<ListLayoutResponse> {
      return this.entityService.getListLayout();
    }

    @Get()
    @RequirePermission(readPermission)
    @ApiOperation({ summary: `List ${config.pluralName.toLowerCase()}` })
    async list(@Query() query: Record<string, any>, @CurrentUser() user: JwtPayload) {
      // Parse pagination params from query string
      const parsed = {
        ...query,
        page: query.page ? Number(query.page) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
        includeDeleted: query.includeDeleted === 'true',
      };
      const accessCtx = buildAccessContext(user, readPermission, config.entityType, this.positionScopeProvider);
      return this.entityService.list(parsed, accessCtx);
    }

    @Get(':id')
    @RequirePermission(readPermission)
    @ApiOperation({ summary: `Get a single ${config.singularName.toLowerCase()} by ID` })
    async findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
      const accessCtx = buildAccessContext(user, readPermission, config.entityType, this.positionScopeProvider);
      return this.entityService.findOneOrFail(id, accessCtx);
    }

    @Post()
    @RequirePermission(createPermission)
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: `Create a new ${config.singularName.toLowerCase()}` })
    async create(@Body() body: Record<string, unknown>, @CurrentUser() user: JwtPayload) {
      return this.entityService.create(body, user.userId);
    }

    @Patch(':id')
    @RequirePermission(updatePermission)
    @ApiOperation({ summary: `Update a ${config.singularName.toLowerCase()}` })
    async update(
      @Param('id', ParseUUIDPipe) id: string,
      @Body() body: Record<string, unknown>,
      @CurrentUser() user: JwtPayload,
    ) {
      const accessCtx = buildAccessContext(user, updatePermission, config.entityType, this.positionScopeProvider);
      return this.entityService.update(id, body, user.userId, accessCtx);
    }

    @Delete(':id')
    @RequirePermission(deletePermission)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: `Soft delete a ${config.singularName.toLowerCase()}` })
    async delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
      const accessCtx = buildAccessContext(user, deletePermission, config.entityType, this.positionScopeProvider);
      await this.entityService.softDelete(id, user.userId, accessCtx);
    }

    @Post(':id/transition')
    @RequirePermission(updatePermission)
    @ApiOperation({ summary: `Transition a workflow field on a ${config.singularName.toLowerCase()}` })
    async transition(
      @Param('id', ParseUUIDPipe) id: string,
      @Body() body: { fieldKey: string; to: string; reason?: string; comment?: string },
      @CurrentUser() user: JwtPayload,
    ) {
      const accessCtx = buildAccessContext(user, updatePermission, config.entityType, this.positionScopeProvider);
      return this.entityService.transition(id, body.fieldKey, body.to, user.userId, { reason: body.reason, comment: body.comment }, accessCtx);
    }

    @Post(':id/clone')
    @RequirePermission(createPermission)
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: `Clone a ${config.singularName.toLowerCase()}` })
    async clone(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
      return this.entityService.clone(id, user.userId);
    }

    @Post(':id/restore')
    @RequirePermission(updatePermission)
    @ApiOperation({ summary: `Restore a soft-deleted ${config.singularName.toLowerCase()}` })
    async restore(@Param('id', ParseUUIDPipe) id: string) {
      return this.entityService.restore(id);
    }

    // ── Hierarchy routes ────────────────────────────────────────────────
    // Only functional when config.hierarchy === true. For non-hierarchical
    // entities, EntityService throws BadRequestException.

    @Post(':id/reparent')
    @RequirePermission(updatePermission)
    @ApiOperation({ summary: `Move a ${config.singularName.toLowerCase()} under a new parent` })
    async reparent(
      @Param('id', ParseUUIDPipe) id: string,
      @Body() body: { parentId: string | null },
      @CurrentUser() user: JwtPayload,
    ) {
      const accessCtx = buildAccessContext(user, updatePermission, config.entityType, this.positionScopeProvider);
      return this.entityService.reparent(id, body.parentId ?? null, user.userId, accessCtx);
    }

    @Get(':id/ancestors')
    @RequirePermission(readPermission)
    @ApiOperation({ summary: `Get the ancestor chain of a ${config.singularName.toLowerCase()}` })
    async getAncestors(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
      const accessCtx = buildAccessContext(user, readPermission, config.entityType, this.positionScopeProvider);
      return this.entityService.getAncestors(id, accessCtx);
    }

    @Get(':id/descendants')
    @RequirePermission(readPermission)
    @ApiOperation({ summary: `Get all descendants of a ${config.singularName.toLowerCase()}` })
    async getDescendants(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
      const accessCtx = buildAccessContext(user, readPermission, config.entityType, this.positionScopeProvider);
      return this.entityService.getDescendants(id, accessCtx);
    }

    // ── Move (unified reparent + reorder) ───────────────────────────────
    // Functional when config.hierarchy === true and/or config.orderable ===
    // true. Accepts { parentId?, sortOrder? }. Callers may pass just one to
    // reorder within the current parent, or both to move and reposition in
    // a single gesture. Non-applicable keys throw 400.

    @Post(':id/move')
    @RequirePermission(updatePermission)
    @ApiOperation({ summary: `Move a ${config.singularName.toLowerCase()} (reparent and/or reorder)` })
    async move(
      @Param('id', ParseUUIDPipe) id: string,
      @Body() body: { parentId?: string | null; sortOrder?: number },
      @CurrentUser() user: JwtPayload,
    ) {
      const accessCtx = buildAccessContext(user, updatePermission, config.entityType, this.positionScopeProvider);
      return this.entityService.move(id, body, user.userId, accessCtx);
    }
  }

  // Give the class a unique name for NestJS DI and debugging
  Object.defineProperty(DynamicEntityController, 'name', {
    value: `${config.singularName.replace(/\s+/g, '')}Controller`,
  });

  return DynamicEntityController;
}
