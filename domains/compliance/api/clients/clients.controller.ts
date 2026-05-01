import {
  BadRequestException,
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
  Put,
  Query,
} from '@nestjs/common';
import {
  AccessContext,
  RequirePermission,
  type DataAccessContext,
} from '@packages/rbac';
import { CurrentUser, type JwtPayload } from '@packages/auth';
import { ClientsService } from './clients.service';
import { ClientContactsService } from '../client-contacts/client-contacts.service';
import { ClientRegistrationsService } from '../client-registrations/client-registrations.service';
import {
  ClientsListQuerySchema,
  CreateClientSchema,
  CreateClientWithContactsSchema,
  DeactivateRegistrationSchema,
  RegisterLawsSchema,
  TransitionClientSchema,
  UpdateClientSchema,
} from './clients.dto';

@Controller('clients')
export class ClientsController {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly contactsService: ClientContactsService,
    private readonly registrationsService: ClientRegistrationsService,
  ) {}

  // ---- Generic CRUD --------------------------------------------------------

  @Get('layout/list')
  @RequirePermission('clients.read')
  getListLayout() {
    return this.clientsService.getListLayout();
  }

  @Get()
  @RequirePermission('clients.read')
  list(
    @Query() query: Record<string, unknown>,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    return this.clientsService.list(ClientsListQuerySchema.parse(query), accessCtx);
  }

  @Get('summary')
  @RequirePermission('clients.read')
  summary(@AccessContext() accessCtx?: DataAccessContext) {
    return this.clientsService.getSummary(accessCtx);
  }

  @Get('handler-options')
  @RequirePermission('clients.read')
  handlerOptions(@AccessContext() accessCtx?: DataAccessContext) {
    return this.clientsService.getHandlerOptions(accessCtx);
  }

  @Get(':id')
  @RequirePermission('clients.read')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    return this.clientsService.findOne(id, accessCtx);
  }

  @Post()
  @RequirePermission('clients.create')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = CreateClientSchema.parse(body);
    return this.clientsService.create(input, user.userId);
  }

  @Patch(':id')
  @RequirePermission('clients.update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const input = UpdateClientSchema.parse(body);
    return this.clientsService.update(id, input, user.userId, accessCtx);
  }

  @Delete(':id')
  @RequirePermission('clients.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    await this.clientsService.softDelete(id, user.userId, accessCtx);
  }

  @Post(':id/transition')
  @RequirePermission('clients.update')
  @HttpCode(HttpStatus.CREATED)
  transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const input = TransitionClientSchema.parse(body);
    return this.clientsService.transition(
      id,
      input.fieldKey,
      input.to,
      user.userId,
      { reason: input.reason, comment: input.comment },
      accessCtx,
    );
  }

  @Get(':id/transition-preview')
  @RequirePermission('clients.update')
  previewTransition(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('fieldKey') fieldKey: string,
    @Query('to') to: string,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    if (!fieldKey || !to) {
      throw new BadRequestException('Query params `fieldKey` and `to` are required');
    }
    return this.clientsService.previewTransition(id, fieldKey, to, user.userId, accessCtx);
  }

  @Post(':id/clone')
  @RequirePermission('clients.create')
  @HttpCode(HttpStatus.CREATED)
  clone(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.clientsService.clone(id, user.userId);
  }

  @Post(':id/restore')
  @RequirePermission('clients.update')
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientsService.restore(id);
  }

  // ---- Composite create + cross-entity endpoints ---------------------------

  @Post('with-contacts')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('clients.create')
  async createWithContacts(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const dto = CreateClientWithContactsSchema.parse(body);
    return this.clientsService.createWithContacts(
      {
        client: {
          ...dto.client,
          complianceOnboardedAt: dto.client.complianceOnboardedAt
            ? new Date(dto.client.complianceOnboardedAt)
            : null,
        },
        contacts: dto.contacts,
      },
      user.userId,
    );
  }

  @Put(':id/contacts/:contactId/primary')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('client-contacts.update')
  async setPrimaryContact(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.contactsService.setPrimary(clientId, contactId, user.userId);
  }

  /**
   * Batch-register a client against one or more laws by code. Kept as a
   * dedicated endpoint (rather than embedding in /clients/with-contacts) so
   * later flows — multi-step forms, a registrations tab, bulk edits — can
   * call it on its own without reconstructing the whole client payload.
   */
  @Post(':id/registrations')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('client-registrations.create')
  async createRegistrations(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const dto = RegisterLawsSchema.parse(body);
    // Scope-check the parent client before mutating registrations. Without
    // this, a holder of `client-registrations.create` could attach laws to a
    // client they have no read scope on. Engine throws NotFoundException on
    // miss — same surface as a missing row, which keeps existence private.
    await this.clientsService.findOne(clientId, accessCtx);
    return this.registrationsService.registerMany(clientId, dto.lawCodes, user.userId);
  }

  /**
   * Preview what would happen if the (client, law) registration were
   * deactivated as of `date`. Used by the deactivation dialog (I7) to
   * populate "M filings after this date will auto-cancel; N filings remain
   * open for earlier periods" before the admin confirms. Permission mirrors
   * the deactivate endpoint so preview counts don't leak to users who can't
   * actually perform the action.
   */
  @Get(':id/registrations/:lawId/deactivation-preview')
  @RequirePermission('client-registrations.delete')
  async previewDeactivation(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Param('lawId', ParseUUIDPipe) lawId: string,
    @Query('date') date?: string,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    if (!date) {
      throw new BadRequestException('Query param `date` is required (ISO-8601)');
    }
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Query param `date` must be a valid ISO-8601 date');
    }
    // Scope-check the parent client — see createRegistrations.
    await this.clientsService.findOne(clientId, accessCtx);
    return this.registrationsService.previewDeactivation(clientId, lawId, parsed);
  }

  @Post(':id/registrations/:lawId/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('client-registrations.delete')
  async deactivateRegistration(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Param('lawId', ParseUUIDPipe) lawId: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const dto = DeactivateRegistrationSchema.parse(body);
    // Scope-check the parent client — destructive cascade gated by the same
    // scope as the read view.
    await this.clientsService.findOne(clientId, accessCtx);
    return this.registrationsService.deactivate(clientId, lawId, {
      deactivatedAt: new Date(dto.deactivatedAt),
      alsoCancelEarlier: dto.alsoCancelEarlier,
      actorId: user.userId,
      comment: dto.comment,
    });
  }
}
