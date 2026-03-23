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
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser, type JwtPayload } from '@packages/auth';
import { RequirePermission } from '@packages/rbac';
import { EntityService } from './entity.service';
import type { EntityConfig } from './types';

/**
 * Creates a NestJS controller class dynamically for an entity.
 *
 * Generates standard REST routes:
 * - GET    /{slug}            → list
 * - GET    /{slug}/:id        → findOne
 * - POST   /{slug}            → create
 * - PATCH  /{slug}/:id        → update
 * - DELETE /{slug}/:id        → softDelete
 * - POST   /{slug}/:id/restore → restore
 *
 * Each route is guarded by @RequirePermission using the entity's slug.
 */
export function createEntityController(config: EntityConfig, serviceToken: string): any {
  const readPermission = `${config.slug}.read`;
  const createPermission = `${config.slug}.create`;
  const updatePermission = `${config.slug}.update`;
  const deletePermission = `${config.slug}.delete`;

  @ApiTags(config.slug)
  @Controller(config.slug)
  class DynamicEntityController {
    constructor(@Inject(serviceToken) private readonly entityService: EntityService) {}

    @Get()
    @RequirePermission(readPermission)
    @ApiOperation({ summary: `List ${config.pluralName.toLowerCase()}` })
    async list(@Query() query: Record<string, any>) {
      // Parse pagination params from query string
      const parsed = {
        ...query,
        page: query.page ? Number(query.page) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
        includeDeleted: query.includeDeleted === 'true',
      };
      return this.entityService.list(parsed);
    }

    @Get(':id')
    @RequirePermission(readPermission)
    @ApiOperation({ summary: `Get a single ${config.singularName.toLowerCase()} by ID` })
    async findOne(@Param('id', ParseUUIDPipe) id: string) {
      return this.entityService.findOneOrFail(id);
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
      return this.entityService.update(id, body, user.userId);
    }

    @Delete(':id')
    @RequirePermission(deletePermission)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: `Soft delete a ${config.singularName.toLowerCase()}` })
    async delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
      await this.entityService.softDelete(id, user.userId);
    }

    @Post(':id/restore')
    @RequirePermission(updatePermission)
    @ApiOperation({ summary: `Restore a soft-deleted ${config.singularName.toLowerCase()}` })
    async restore(@Param('id', ParseUUIDPipe) id: string) {
      return this.entityService.restore(id);
    }
  }

  // Give the class a unique name for NestJS DI and debugging
  Object.defineProperty(DynamicEntityController, 'name', {
    value: `${config.singularName.replace(/\s+/g, '')}Controller`,
  });

  return DynamicEntityController;
}
