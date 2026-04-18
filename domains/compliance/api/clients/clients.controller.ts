import { Body, Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { RequirePermission } from '@packages/rbac';
import { ClientsService } from './clients.service';
import { ClientContactsService } from '../client-contacts/client-contacts.service';
import { CreateClientWithContactsDto } from './dto/create-with-contacts.dto';

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
  ) {}

  @Post('with-contacts')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('clients.create')
  async createWithContacts(@Body() dto: CreateClientWithContactsDto) {
    return this.clientsService.createWithContacts({
      client: {
        ...dto.client,
        onboardedAt: dto.client.onboardedAt ? new Date(dto.client.onboardedAt) : null,
      },
      contacts: dto.contacts,
    });
  }

  @Put(':id/contacts/:contactId/primary')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('client-contacts.update')
  async setPrimaryContact(
    @Param('id', ParseUUIDPipe) clientId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ): Promise<void> {
    await this.contactsService.setPrimary(clientId, contactId);
  }
}
