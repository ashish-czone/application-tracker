import { Body, Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { RequirePermission } from '@packages/rbac';
import { CurrentUser, type JwtPayload } from '@packages/auth';
import { ClientsService } from './clients.service';
import { ClientContactsService } from '../client-contacts/client-contacts.service';
import { ClientRegistrationService } from '../client-registrations/client-registrations.service';
import { CreateClientWithContactsDto } from './dto/create-with-contacts.dto';
import { RegisterLawsDto } from './dto/register-laws.dto';

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
}
