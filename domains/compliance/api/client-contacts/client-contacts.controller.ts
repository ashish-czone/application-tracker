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
import {
  ClientContactsListQuerySchema,
  CreateClientContactSchema,
  UpdateClientContactSchema,
} from './client-contacts.dto';

@Controller('client-contacts')
export class ClientContactsController {
  constructor(private readonly clientContacts: ClientContactsService) {}

  @Get()
  @RequirePermission('client-contacts.read')
  list(@Query() query: Record<string, unknown>, @AccessContext() accessCtx?: DataAccessContext) {
    const parsed = ClientContactsListQuerySchema.parse(query);
    return this.clientContacts.list(parsed, accessCtx);
  }

  @Get(':id')
  @RequirePermission('client-contacts.read')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    // findOneOrFail (not findOne) — BaseCrudService.findOne returns null
    // on miss; the controller wants 404 to surface as NotFoundException.
    return this.clientContacts.findOneOrFail(id, accessCtx);
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
}
