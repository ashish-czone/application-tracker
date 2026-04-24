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
import { ClientContactsService } from './client-contacts.service';
import { CreateClientContactSchema, UpdateClientContactSchema } from './client-contacts.dto';

@Controller('client-contacts')
export class ClientContactsController {
  constructor(private readonly clientContacts: ClientContactsService) {}

  @Get('layout/list')
  @RequirePermission('client-contacts.read')
  getListLayout() {
    return this.clientContacts.getListLayout();
  }

  @Get()
  @RequirePermission('client-contacts.read')
  list(@Query() query: Record<string, unknown>, @AccessContext() accessCtx?: DataAccessContext) {
    const parsed = {
      ...query,
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      includeDeleted: query.includeDeleted === 'true',
    };
    return this.clientContacts.list(parsed, accessCtx);
  }

  @Get(':id')
  @RequirePermission('client-contacts.read')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    return this.clientContacts.findOne(id, accessCtx);
  }

  @Post()
  @RequirePermission('client-contacts.create')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = CreateClientContactSchema.parse(body);
    return this.clientContacts.create(input, user.userId);
  }

  @Patch(':id')
  @RequirePermission('client-contacts.update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const input = UpdateClientContactSchema.parse(body);
    return this.clientContacts.update(id, input, user.userId, accessCtx);
  }

  @Delete(':id')
  @RequirePermission('client-contacts.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    await this.clientContacts.softDelete(id, user.userId, accessCtx);
  }

  @Post(':id/clone')
  @RequirePermission('client-contacts.create')
  @HttpCode(HttpStatus.CREATED)
  clone(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.clientContacts.clone(id, user.userId);
  }

  @Post(':id/restore')
  @RequirePermission('client-contacts.update')
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientContacts.restore(id);
  }
}
