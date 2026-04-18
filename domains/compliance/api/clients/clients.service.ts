import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '@packages/database';
import { clients } from '../schema/clients';
import { clientContacts } from '../schema/client-contacts';

export interface ClientInput {
  name: string;
  legalName: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  taxId?: string | null;
  industryId?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  countryId?: string | null;
  accountManagerId?: string | null;
  status?: string;
  onboardedAt?: Date | null;
  notes?: string | null;
}

export interface ContactInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  designation?: string | null;
  isPrimary?: boolean;
  notes?: string | null;
}

export interface CreateWithContactsInput {
  client: ClientInput;
  contacts: ContactInput[];
}

export interface Client {
  id: string;
  name: string;
  legalName: string;
  status: string;
  createdAt: Date;
}

export interface Contact {
  id: string;
  clientId: string;
  name: string;
  isPrimary: boolean;
}

export interface CreateWithContactsResult {
  client: Client;
  contacts: Contact[];
}

@Injectable()
export class ClientsService {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Create a client together with its contacts in a single transaction.
   * Exactly one contact must be flagged as primary — the partial unique
   * index on (client_id) WHERE is_primary = true enforces this at the
   * database level, but we validate up-front to return a readable error.
   */
  async createWithContacts(input: CreateWithContactsInput): Promise<CreateWithContactsResult> {
    this.validateContacts(input.contacts);

    return this.database.db.transaction(async (tx) => {
      const [clientRow] = await tx
        .insert(clients)
        .values({
          name: input.client.name,
          legalName: input.client.legalName,
          email: input.client.email ?? null,
          phone: input.client.phone ?? null,
          website: input.client.website ?? null,
          taxId: input.client.taxId ?? null,
          industryId: input.client.industryId ?? null,
          addressLine1: input.client.addressLine1 ?? null,
          addressLine2: input.client.addressLine2 ?? null,
          city: input.client.city ?? null,
          state: input.client.state ?? null,
          postalCode: input.client.postalCode ?? null,
          countryId: input.client.countryId ?? null,
          accountManagerId: input.client.accountManagerId ?? null,
          status: input.client.status ?? 'onboarding',
          onboardedAt: input.client.onboardedAt ?? null,
          notes: input.client.notes ?? null,
        })
        .returning();

      const contactValues = input.contacts.map((c) => ({
        clientId: clientRow.id,
        name: c.name,
        email: c.email ?? null,
        phone: c.phone ?? null,
        designation: c.designation ?? null,
        isPrimary: c.isPrimary ?? false,
        notes: c.notes ?? null,
      }));

      const contactRows = await tx.insert(clientContacts).values(contactValues).returning();

      return {
        client: this.toClient(clientRow),
        contacts: contactRows.map((r) => this.toContact(r)),
      };
    });
  }

  private validateContacts(contacts: ContactInput[]): void {
    if (!contacts || contacts.length < 1) {
      throw new BadRequestException('At least one contact is required');
    }
    const primaryCount = contacts.filter((c) => c.isPrimary === true).length;
    if (primaryCount !== 1) {
      throw new BadRequestException(
        `Exactly one contact must be marked as primary (got ${primaryCount})`,
      );
    }
  }

  private toClient(row: typeof clients.$inferSelect): Client {
    return {
      id: row.id,
      name: row.name,
      legalName: row.legalName,
      status: row.status,
      createdAt: row.createdAt,
    };
  }

  private toContact(row: typeof clientContacts.$inferSelect): Contact {
    return {
      id: row.id,
      clientId: row.clientId,
      name: row.name,
      isPrimary: row.isPrimary,
    };
  }
}
