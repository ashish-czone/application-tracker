import { Injectable, Inject, type OnModuleInit } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { DatabaseService, users } from '@packages/database';
import { EntityService } from '@packages/entity-engine';
import { clients } from './schema/clients';
import { contacts } from '../contacts/schema/contacts';
import { vendors } from '../vendors/schema/vendors';
import { interviews } from '../interviews/schema/interviews';
import { candidates } from '../candidates/schema/candidates';
import { jobOpenings } from '../job-openings/schema/job-openings';

const CLIENTS_SERVICE_TOKEN = 'ENTITY_SERVICE_clients';
const CONTACTS_SERVICE_TOKEN = 'ENTITY_SERVICE_contacts';
const VENDORS_SERVICE_TOKEN = 'ENTITY_SERVICE_vendors';
const INTERVIEWS_SERVICE_TOKEN = 'ENTITY_SERVICE_interviews';

const SAMPLE_CLIENTS = [
  {
    clientName: 'Acme Corporation',
    industry: 'technology',
    contactNumber: '+1-555-100-2000',
    website: 'https://acme.example.com',
    about: 'Global technology leader specializing in enterprise SaaS solutions.',
    billingCity: 'San Francisco',
    billingProvince: 'CA',
    billingCountry: 'United States',
  },
  {
    clientName: 'Globex Industries',
    industry: 'manufacturing',
    contactNumber: '+1-555-200-3000',
    website: 'https://globex.example.com',
    about: 'Leading manufacturer of industrial automation equipment.',
    billingCity: 'Detroit',
    billingProvince: 'MI',
    billingCountry: 'United States',
  },
  {
    clientName: 'Initech Solutions',
    industry: 'it-services',
    contactNumber: '+44-20-7946-0958',
    website: 'https://initech.example.com',
    about: 'IT consulting and managed services for mid-market enterprises.',
    billingCity: 'London',
    billingCountry: 'United Kingdom',
  },
  {
    clientName: 'Stark Healthcare',
    industry: 'health-care',
    contactNumber: '+1-555-400-5000',
    website: 'https://starkhc.example.com',
    about: 'Healthcare technology company focused on patient management systems.',
    billingCity: 'Boston',
    billingProvince: 'MA',
    billingCountry: 'United States',
  },
];

const SAMPLE_CONTACTS = [
  { firstName: 'Sarah', lastName: 'Williams', email: 'sarah.williams@acme.example.com', jobTitle: 'VP of Engineering', workPhone: '+1-555-100-2001', isPrimaryContact: true },
  { firstName: 'James', lastName: 'Chen', email: 'james.chen@acme.example.com', jobTitle: 'Hiring Manager', workPhone: '+1-555-100-2002' },
  { firstName: 'Emily', lastName: 'Thompson', email: 'emily.thompson@globex.example.com', jobTitle: 'HR Director', workPhone: '+1-555-200-3001', isPrimaryContact: true },
  { firstName: 'Raj', lastName: 'Patel', email: 'raj.patel@initech.example.com', jobTitle: 'CTO', workPhone: '+44-20-7946-0959', isPrimaryContact: true },
  { firstName: 'Lisa', lastName: 'Martinez', email: 'lisa.martinez@starkhc.example.com', jobTitle: 'Talent Acquisition Lead', workPhone: '+1-555-400-5001', isPrimaryContact: true },
];

const SAMPLE_VENDORS = [
  { vendorName: 'TechTalent Partners', email: 'info@techtalent.example.com', phone: '+1-555-600-7000', website: 'https://techtalent.example.com', city: 'Austin', province: 'TX', country: 'United States' },
  { vendorName: 'Global Staffing Co', email: 'contact@globalstaffing.example.com', phone: '+44-20-8123-4567', website: 'https://globalstaffing.example.com', city: 'London', country: 'United Kingdom' },
  { vendorName: 'Elite Recruiters', email: 'hello@eliterecruiters.example.com', phone: '+1-555-700-8000', city: 'New York', province: 'NY', country: 'United States' },
];

@Injectable()
export class ClientsSeedService implements OnModuleInit {
  private readonly logger: ContextLogger;

  constructor(
    private readonly database: DatabaseService,
    @Inject(CLIENTS_SERVICE_TOKEN) private readonly clientService: EntityService,
    @Inject(CONTACTS_SERVICE_TOKEN) private readonly contactService: EntityService,
    @Inject(VENDORS_SERVICE_TOKEN) private readonly vendorService: EntityService,
    @Inject(INTERVIEWS_SERVICE_TOKEN) private readonly interviewService: EntityService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(ClientsSeedService.name);
  }

  async onModuleInit() {
    await this.ensureSampleClients();
    await this.ensureSampleContacts();
    await this.ensureSampleVendors();
    await this.linkJobOpeningsToClients();
    await this.ensureSampleInterviews();
  }

  private async ensureSampleClients() {
    const [existing] = await this.database.db.select({ id: clients.id }).from(clients).limit(1);
    if (existing) return;

    const [admin] = await this.database.db.select({ id: users.id }).from(users).limit(1);
    if (!admin) { this.logger.warn('No users found — skipping client seeding'); return; }

    for (const data of SAMPLE_CLIENTS) {
      await this.clientService.create(data, admin.id);
    }
    this.logger.log(`Created ${SAMPLE_CLIENTS.length} sample clients`);
  }

  private async ensureSampleContacts() {
    const [existing] = await this.database.db.select({ id: contacts.id }).from(contacts).limit(1);
    if (existing) return;

    const [admin] = await this.database.db.select({ id: users.id }).from(users).limit(1);
    if (!admin) return;

    const clientRows = await this.database.db.select({ id: clients.id }).from(clients).limit(4);
    if (clientRows.length === 0) { this.logger.warn('No clients — skipping contact seeding'); return; }

    // Assign contacts to clients: 2 for first client, 1 each for the rest
    const contactsWithClients = SAMPLE_CONTACTS.map((c, i) => ({
      ...c,
      clientId: i < 2 ? clientRows[0]?.id : clientRows[Math.min(i - 1, clientRows.length - 1)]?.id,
    }));

    for (const data of contactsWithClients) {
      await this.contactService.create(data, admin.id);
    }
    this.logger.log(`Created ${SAMPLE_CONTACTS.length} sample contacts`);
  }

  private async ensureSampleVendors() {
    const [existing] = await this.database.db.select({ id: vendors.id }).from(vendors).limit(1);
    if (existing) return;

    const [admin] = await this.database.db.select({ id: users.id }).from(users).limit(1);
    if (!admin) return;

    for (const data of SAMPLE_VENDORS) {
      await this.vendorService.create(data, admin.id);
    }
    this.logger.log(`Created ${SAMPLE_VENDORS.length} sample vendors`);
  }

  private async linkJobOpeningsToClients() {
    // Link existing job openings to clients if they don't have one
    const joRows = await this.database.db
      .select({ id: jobOpenings.id, clientId: jobOpenings.clientId })
      .from(jobOpenings)
      .limit(5);

    if (joRows.length === 0 || joRows[0]?.clientId) return;

    const clientRows = await this.database.db.select({ id: clients.id }).from(clients).limit(4);
    if (clientRows.length === 0) return;

    const { eq } = await import('drizzle-orm');
    for (let i = 0; i < joRows.length; i++) {
      const clientId = clientRows[i % clientRows.length]?.id;
      if (clientId) {
        await this.database.db.update(jobOpenings).set({ clientId }).where(eq(jobOpenings.id, joRows[i].id));
      }
    }
    this.logger.log(`Linked ${joRows.length} job openings to clients`);
  }

  private async ensureSampleInterviews() {
    const [existing] = await this.database.db.select({ id: interviews.id }).from(interviews).limit(1);
    if (existing) return;

    const [admin] = await this.database.db.select({ id: users.id }).from(users).limit(1);
    if (!admin) return;

    const candidateRows = await this.database.db.select({ id: candidates.id }).from(candidates).limit(3);
    const joRows = await this.database.db.select({ id: jobOpenings.id, clientId: jobOpenings.clientId }).from(jobOpenings).limit(3);

    if (candidateRows.length === 0 || joRows.length === 0) {
      this.logger.warn('No candidates or job openings — skipping interview seeding');
      return;
    }

    const now = new Date();
    const sampleInterviews = [
      {
        interviewName: 'phone-interview',
        candidateId: candidateRows[0]?.id,
        jobOpeningId: joRows[0]?.id,
        clientId: joRows[0]?.clientId,
        interviewFrom: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        interviewTo: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
        location: 'Phone',
        status: 'scheduled',
      },
      {
        interviewName: 'level-1-interview',
        candidateId: candidateRows[1]?.id,
        jobOpeningId: joRows[0]?.id,
        clientId: joRows[0]?.clientId,
        interviewFrom: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        interviewTo: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000).toISOString(),
        location: 'Zoom Meeting',
        status: 'scheduled',
      },
      {
        interviewName: 'level-2-interview',
        candidateId: candidateRows[0]?.id,
        jobOpeningId: joRows[1]?.id,
        clientId: joRows[1]?.clientId,
        interviewFrom: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        interviewTo: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
        location: 'On-site — San Francisco Office',
        status: 'completed',
        scheduleComments: 'Candidate performed well in technical round.',
      },
      {
        interviewName: 'general-interview',
        candidateId: candidateRows[2]?.id,
        jobOpeningId: joRows[2]?.id,
        clientId: joRows[2]?.clientId,
        interviewFrom: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        interviewTo: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000).toISOString(),
        location: 'Google Meet',
        status: 'scheduled',
      },
    ].filter((i) => i.candidateId && i.jobOpeningId);

    for (const data of sampleInterviews) {
      await this.interviewService.create(data, admin.id);
    }
    this.logger.log(`Created ${sampleInterviews.length} sample interviews`);
  }
}
