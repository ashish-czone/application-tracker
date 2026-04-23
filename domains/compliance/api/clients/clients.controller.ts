import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { RequirePermission } from '@packages/rbac';
import { CurrentUser, type JwtPayload } from '@packages/auth';
import { ClientsService } from './clients.service';
import { ClientContactsService } from '../client-contacts/client-contacts.service';
import { ClientRegistrationService } from '../client-registrations/client-registrations.service';
import { CreateClientWithContactsDto } from './dto/create-with-contacts.dto';
import { RegisterLawsDto } from './dto/register-laws.dto';
import { DeactivateRegistrationDto } from './dto/deactivate-registration.dto';

/**
 * Custom client endpoints that layer on top of the generic entity-engine
 * controller auto-registered for `clients` and `client-contacts`. The
 * transactional create-with-contacts and the atomic primary-contact flip
 * cannot be expressed through the generic CRUD, so they live here.
 */
@Controller('clients')
export class ClientsController {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly contactsService: ClientContactsService,
    private readonly registrationsService: ClientRegistrationService,
  ) {}

  @Post('with-contacts')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('clients.create')
  async createWithContacts(
    @Body() dto: CreateClientWithContactsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.clientsService.createWithContacts(
      {
        client: {
          ...dto.client,
          onboardedAt: dto.client.onboardedAt ? new Date(dto.client.onboardedAt) : null,
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
    @Body() dto: RegisterLawsDto,
    @CurrentUser() user: JwtPayload,
  ) {
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
  ) {
    if (!date) {
      throw new BadRequestException('Query param `date` is required (ISO-8601)');
    }
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Query param `date` must be a valid ISO-8601 date');
    }
    return this.registrationsService.previewDeactivation(clientId, lawId, parsed);
  }

  @Post(':id/registrations/:lawId/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('client-registrations.delete')
  async deactivateRegistration(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Param('lawId', ParseUUIDPipe) lawId: string,
    @Body() dto: DeactivateRegistrationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.registrationsService.deactivate(clientId, lawId, {
      deactivatedAt: new Date(dto.deactivatedAt),
      alsoCancelEarlier: dto.alsoCancelEarlier,
      actorId: user.userId,
      comment: dto.comment,
    });
  }
}
