import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type JwtPayload } from '@packages/auth';
import {
  AccessContext,
  RequirePermission,
  type DataAccessContext,
} from '@packages/rbac';
import { VendorsService } from './vendors.service';
import { CreateVendorSchema, UpdateVendorSchema } from './vendors.dto';

/**
 * Thin HTTP controller for vendors. Domain verbs (beyond CRUD) would be
 * added here as their own @Post(':id/<verb>') methods, delegating to a
 * matching `VendorsService` method.
 *
 * Route shape matches the engine's previous auto-generated controller so
 * existing frontend callers keep working.
 */
@ApiTags('vendors')
@Controller('vendors')
export class VendorsController {
  constructor(private readonly vendors: VendorsService) {}

  @Get('layout/list')
  @RequirePermission('vendors.read')
  @ApiOperation({ summary: 'Get list layout config for vendors' })
  getListLayout() {
    return this.vendors.getListLayout();
  }

  @Get()
  @RequirePermission('vendors.read')
  @ApiOperation({ summary: 'List vendors' })
  list(@Query() query: Record<string, unknown>, @AccessContext() accessCtx?: DataAccessContext) {
    const parsed = {
      ...query,
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      includeDeleted: query.includeDeleted === 'true',
    };
    return this.vendors.list(parsed, accessCtx);
  }

  @Get(':id')
  @RequirePermission('vendors.read')
  @ApiOperation({ summary: 'Get a single vendor by ID' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    return this.vendors.findOne(id, accessCtx);
  }

  @Post()
  @RequirePermission('vendors.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new vendor' })
  create(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = CreateVendorSchema.parse(body);
    return this.vendors.create(input, user.userId);
  }

  @Patch(':id')
  @RequirePermission('vendors.update')
  @ApiOperation({ summary: 'Update a vendor' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const input = UpdateVendorSchema.parse(body);
    return this.vendors.update(id, input, user.userId, accessCtx);
  }

  @Delete(':id')
  @RequirePermission('vendors.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a vendor' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    await this.vendors.softDelete(id, user.userId, accessCtx);
  }

  @Post(':id/clone')
  @RequirePermission('vendors.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Clone a vendor' })
  clone(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.vendors.clone(id, user.userId);
  }

  @Post(':id/restore')
  @RequirePermission('vendors.update')
  @ApiOperation({ summary: 'Restore a soft-deleted vendor' })
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.vendors.restore(id);
  }
}
