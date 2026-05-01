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
import { CurrentUser, type JwtPayload } from '@packages/auth';
import {
  AccessContext,
  RequirePermission,
  type DataAccessContext,
} from '@packages/rbac';
import { OrganizationsService } from './organizations.service';
import {
  CreateOrganizationSchema,
  OrganizationsListQuerySchema,
  UpdateOrganizationSchema,
} from './organizations.dto';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get('layout/list')
  @RequirePermission('organizations.read')
  getListLayout() {
    return this.organizations.getListLayout();
  }

  @Get()
  @RequirePermission('organizations.read')
  list(@Query() query: Record<string, unknown>, @AccessContext() accessCtx?: DataAccessContext) {
    return this.organizations.list(OrganizationsListQuerySchema.parse(query), accessCtx);
  }

  @Get(':id')
  @RequirePermission('organizations.read')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    return this.organizations.findOne(id, accessCtx);
  }

  @Post()
  @RequirePermission('organizations.create')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = CreateOrganizationSchema.parse(body);
    return this.organizations.create(input, user.userId);
  }

  @Patch(':id')
  @RequirePermission('organizations.update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const input = UpdateOrganizationSchema.parse(body);
    return this.organizations.update(id, input, user.userId, accessCtx);
  }

  @Delete(':id')
  @RequirePermission('organizations.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    await this.organizations.softDelete(id, user.userId, accessCtx);
  }
}
