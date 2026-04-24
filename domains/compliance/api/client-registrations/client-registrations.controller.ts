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
import { ClientRegistrationsService } from './client-registrations.service';
import {
  CreateClientRegistrationSchema,
  UpdateClientRegistrationSchema,
} from './client-registrations.dto';

@Controller('client-registrations')
export class ClientRegistrationsController {
  constructor(private readonly clientRegistrations: ClientRegistrationsService) {}

  @Get('layout/list')
  @RequirePermission('client-registrations.read')
  getListLayout() {
    return this.clientRegistrations.getListLayout();
  }

  @Get()
  @RequirePermission('client-registrations.read')
  list(@Query() query: Record<string, unknown>, @AccessContext() accessCtx?: DataAccessContext) {
    const parsed = {
      ...query,
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      includeDeleted: query.includeDeleted === 'true',
    };
    return this.clientRegistrations.list(parsed, accessCtx);
  }

  @Get(':id')
  @RequirePermission('client-registrations.read')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    return this.clientRegistrations.findOne(id, accessCtx);
  }

  @Post()
  @RequirePermission('client-registrations.create')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = CreateClientRegistrationSchema.parse(body);
    return this.clientRegistrations.create(input, user.userId);
  }

  @Patch(':id')
  @RequirePermission('client-registrations.update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const input = UpdateClientRegistrationSchema.parse(body);
    return this.clientRegistrations.update(id, input, user.userId, accessCtx);
  }

  @Delete(':id')
  @RequirePermission('client-registrations.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    await this.clientRegistrations.softDelete(id, user.userId, accessCtx);
  }

  @Post(':id/clone')
  @RequirePermission('client-registrations.create')
  @HttpCode(HttpStatus.CREATED)
  clone(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.clientRegistrations.clone(id, user.userId);
  }

  @Post(':id/restore')
  @RequirePermission('client-registrations.update')
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientRegistrations.restore(id);
  }
}
