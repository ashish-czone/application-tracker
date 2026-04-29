import type { INestApplicationContext } from '@nestjs/common';
import { DatabaseService, eq, isNotNull, sql, users } from '@packages/database';
import { EntityService } from '@packages/entity-engine';
import { ClientsService } from '../clients.service';
import { companies } from '../companies-ref';
import { contacts } from '../../contacts/schema/contacts';
import { vendors } from '../../vendors/schema/vendors';
import { interviews } from '../../interviews/schema/interviews';
import { candidates } from '../../candidates/schema/candidates';
import { jobOpenings } from '../../job-openings/schema/job-openings';

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
    _billingCountryName: 'United States',
  },
  {
    clientName: 'Globex Industries',
    industry: 'manufacturing',
    contactNumber: '+1-555-200-3000',
    website: 'https://globex.example.com',
    about: 'Leading manufacturer of industrial automation equipment.',
    billingCity: 'Detroit',
    billingProvince: 'MI',
    _billingCountryName: 'United States',
  },
  {
    clientName: 'Initech Solutions',
    industry: 'it-services',
    contactNumber: '+44-20-7946-0958',
    website: 'https://initech.example.com',
    about: 'IT consulting and managed services for mid-market enterprises.',
    billingCity: 'London',
    _billingCountryName: 'United Kingdom',
  },
  {
    clientName: 'Stark Healthcare',
    industry: 'health-care',
    contactNumber: '+1-555-400-5000',
    website: 'https://starkhc.example.com',
    about: 'Healthcare technology company focused on patient management systems.',
    billingCity: 'Boston',
    billingProvince: 'MA',
    _billingCountryName: 'United States',
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
  { vendorName: 'TechTalent Partners', email: 'info@techtalent.example.com', phone: '+1-555-600-7000', website: 'https://techtalent.example.com', city: 'Austin', province: 'TX', _countryName: 'United States' },
  { vendorName: 'Global Staffing Co', email: 'contact@globalstaffing.example.com', phone: '+44-20-8123-4567', website: 'https://globalstaffing.example.com', city: 'London', _countryName: 'United Kingdom' },
  { vendorName: 'Elite Recruiters', email: 'hello@eliterecruiters.example.com', phone: '+1-555-700-8000', city: 'New York', province: 'NY', _countryName: 'United States' },
];

export const seedDemoClients = async (ctx: INestApplicationContext): Promise<void> => {
  const database = ctx.get(DatabaseService);
  const clientsService = ctx.get(ClientsService, { strict: false });
  const contactService = ctx.get<EntityService>(CONTACTS_SERVICE_TOKEN);
  const vendorService = ctx.get<EntityService>(VENDORS_SERVICE_TOKEN);
  const interviewService = ctx.get<EntityService>(INTERVIEWS_SERVICE_TOKEN);

  const countryCache = new Map<string, string>();
  const resolveCountryId = async (name: string): Promise<string | undefined> => {
    if (countryCache.has(name)) return countryCache.get(name);
    const [row] = (await database.db
      .select({ id: sql`c.id` })
      .from(sql`categories c JOIN category_groups cg ON c.group_id = cg.id`)
      .where(sql`cg.slug = 'countries' AND c.name = ${name}`)
      .limit(1)) as { id: string }[];
    if (row) countryCache.set(name, row.id);
    return row?.id;
  };

  await ensureSampleClients(database, clientsService, resolveCountryId);
  await ensureSampleContacts(database, contactService);
  await ensureSampleVendors(database, vendorService, resolveCountryId);
  await linkJobOpeningsToClients(database);
  await ensureSampleInterviews(database, interviewService);
};

async function ensureSampleClients(
  database: DatabaseService,
  clientsService: ClientsService,
  resolveCountryId: (name: string) => Promise<string | undefined>,
): Promise<void> {
  const [existing] = await database.db
    .select({ id: companies.id })
    .from(companies)
    .where(isNotNull(companies.recruitBecameClientAt))
    .limit(1);
  if (existing) return;

  const [admin] = await database.db.select({ id: users.id }).from(users).limit(1);
  if (!admin) return;

  for (const { _billingCountryName, ...data } of SAMPLE_CLIENTS) {
    const billingCountry = await resolveCountryId(_billingCountryName);
    await clientsService.create({ ...data, billingCountry } as any, admin.id);
  }
}

async function ensureSampleContacts(
  database: DatabaseService,
  contactService: EntityService,
): Promise<void> {
  const [existing] = await database.db.select({ id: contacts.id }).from(contacts).limit(1);
  if (existing) return;

  const [admin] = await database.db.select({ id: users.id }).from(users).limit(1);
  if (!admin) return;

  const clientRows = await database.db
    .select({ companyId: companies.id })
    .from(companies)
    .where(isNotNull(companies.recruitBecameClientAt))
    .limit(4);
  if (clientRows.length === 0) return;

  const contactsWithClients = SAMPLE_CONTACTS.map((c, i) => ({
    ...c,
    companyId: i < 2 ? clientRows[0]?.companyId : clientRows[Math.min(i - 1, clientRows.length - 1)]?.companyId,
  }));

  for (const data of contactsWithClients) {
    await contactService.create(data, admin.id);
  }
}

async function ensureSampleVendors(
  database: DatabaseService,
  vendorService: EntityService,
  resolveCountryId: (name: string) => Promise<string | undefined>,
): Promise<void> {
  const [existing] = await database.db.select({ id: vendors.id }).from(vendors).limit(1);
  if (existing) return;

  const [admin] = await database.db.select({ id: users.id }).from(users).limit(1);
  if (!admin) return;

  for (const { _countryName, ...data } of SAMPLE_VENDORS) {
    const country = await resolveCountryId(_countryName);
    await vendorService.create({ ...data, country }, admin.id);
  }
}

async function linkJobOpeningsToClients(database: DatabaseService): Promise<void> {
  const joRows = await database.db
    .select({ id: jobOpenings.id, companyId: jobOpenings.companyId })
    .from(jobOpenings)
    .limit(5);

  if (joRows.length === 0 || joRows[0]?.companyId) return;

  const clientRows = await database.db
    .select({ companyId: companies.id })
    .from(companies)
    .where(isNotNull(companies.recruitBecameClientAt))
    .limit(4);
  if (clientRows.length === 0) return;

  for (let i = 0; i < joRows.length; i++) {
    const companyId = clientRows[i % clientRows.length]?.companyId;
    if (companyId) {
      await database.db
        .update(jobOpenings)
        .set({ companyId })
        .where(eq(jobOpenings.id, joRows[i].id));
    }
  }
}

async function ensureSampleInterviews(
  database: DatabaseService,
  interviewService: EntityService,
): Promise<void> {
  const [existing] = await database.db.select({ id: interviews.id }).from(interviews).limit(1);
  if (existing) return;

  const [admin] = await database.db.select({ id: users.id }).from(users).limit(1);
  if (!admin) return;

  const candidateRows = await database.db.select({ id: candidates.id }).from(candidates).limit(3);
  const joRows = await database.db
    .select({ id: jobOpenings.id, companyId: jobOpenings.companyId })
    .from(jobOpenings)
    .limit(3);

  if (candidateRows.length === 0 || joRows.length === 0) return;

  const now = new Date();
  const sampleInterviews = [
    {
      interviewName: 'Phone Interview',
      candidateId: candidateRows[0]?.id,
      jobOpeningId: joRows[0]?.id,
      companyId: joRows[0]?.companyId,
      interviewFrom: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      interviewTo: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
      location: 'Phone',
      status: 'scheduled',
    },
    {
      interviewName: 'Level 1 Interview',
      candidateId: candidateRows[1]?.id,
      jobOpeningId: joRows[0]?.id,
      companyId: joRows[0]?.companyId,
      interviewFrom: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      interviewTo: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000).toISOString(),
      location: 'Zoom Meeting',
      status: 'scheduled',
    },
    {
      interviewName: 'Level 2 Interview',
      candidateId: candidateRows[0]?.id,
      jobOpeningId: joRows[1]?.id,
      companyId: joRows[1]?.companyId,
      interviewFrom: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      interviewTo: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
      location: 'On-site — San Francisco Office',
      status: 'completed',
      scheduleComments: 'Candidate performed well in technical round.',
    },
    {
      interviewName: 'General Interview',
      candidateId: candidateRows[2]?.id,
      jobOpeningId: joRows[2]?.id,
      companyId: joRows[2]?.companyId,
      interviewFrom: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      interviewTo: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000).toISOString(),
      location: 'Google Meet',
      status: 'scheduled',
    },
  ].filter((i) => i.candidateId && i.jobOpeningId);

  for (const data of sampleInterviews) {
    await interviewService.create(data, admin.id);
  }
}
