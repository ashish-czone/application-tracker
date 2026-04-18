import type { INestApplicationContext } from '@nestjs/common';
import { DatabaseService } from '@packages/database';
import { ClientsService } from '../clients.service';
import { clients } from '../../schema/clients';

interface DemoClient {
  name: string;
  legalName: string;
  taxId: string;
  email: string;
  status: 'onboarding' | 'active' | 'dormant';
  onboardedAt: string;
}

const DEMO_CLIENTS: DemoClient[] = [
  { name: 'Aarav Industries',   legalName: 'Aarav Industries Pvt. Ltd.',                taxId: '27AABCA1234H1Z5', email: 'finance@aaravindustries.in',     status: 'active',     onboardedAt: '2024-03-15' },
  { name: 'Bluewave Exports',   legalName: 'Bluewave Exports LLP',                      taxId: '29BAAAB5678G1Z9', email: 'compliance@bluewave.co.in',      status: 'active',     onboardedAt: '2023-07-01' },
  { name: 'Cedar Retail',       legalName: 'Cedar Retail Stores Ltd.',                  taxId: '07CCCCC9012F1Z1', email: 'accounts@cedarretail.com',       status: 'active',     onboardedAt: '2024-01-10' },
  { name: 'Drift Media',        legalName: 'Drift Media Holdings',                      taxId: '33DDDDD3456E1Z3', email: 'legal@driftmedia.in',            status: 'active',     onboardedAt: '2024-06-20' },
  { name: 'Evergreen Labs',     legalName: 'Evergreen Biological Labs',                 taxId: '36EEEEE7890D1Z5', email: 'cfo@evergreenlabs.co.in',        status: 'active',     onboardedAt: '2023-11-05' },
  { name: 'Fable Studios',      legalName: 'Fable Studios Pvt. Ltd.',                   taxId: '24FFFFF2345C1Z7', email: 'ops@fablestudios.in',            status: 'active',     onboardedAt: '2025-01-12' },
  { name: 'Greenfield Agri',    legalName: 'Greenfield Agricultural Co.',               taxId: '06GGGGG6789B1Z2', email: 'admin@greenfieldagri.in',        status: 'onboarding', onboardedAt: '2026-04-01' },
  { name: 'Horizon Pharma',     legalName: 'Horizon Pharmaceuticals Ltd.',              taxId: '27HHHHH1234A1Z8', email: 'compliance@horizonpharma.co.in', status: 'active',     onboardedAt: '2023-04-18' },
  { name: 'Indigo Logistics',   legalName: 'Indigo Logistics & Supply Chain Pvt. Ltd.', taxId: '32IIIII5678C1Z4', email: 'tax@indigologistics.in',         status: 'active',     onboardedAt: '2024-09-10' },
  { name: 'Jade Constructions', legalName: 'Jade Constructions & Infra Ltd.',           taxId: '27JJJJJ9012D1Z6', email: 'cfo@jadeconstruction.in',        status: 'dormant',    onboardedAt: '2023-08-22' },
  { name: 'Kite Finserv',       legalName: 'Kite Financial Services Pvt. Ltd.',         taxId: '29KKKKK3456E1Z0', email: 'regulatory@kitefinserv.com',     status: 'active',     onboardedAt: '2024-02-14' },
  { name: 'Lumen Tech',         legalName: 'Lumen Technologies India Pvt. Ltd.',        taxId: '36LLLLL7890F1Z2', email: 'finance@lumentech.in',           status: 'active',     onboardedAt: '2024-05-30' },
];

function contactNameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? 'contact';
  return local.charAt(0).toUpperCase() + local.slice(1) + ' Desk';
}

export const seedDemoClients = async (ctx: INestApplicationContext): Promise<void> => {
  const database = ctx.get(DatabaseService);
  const service = ctx.get(ClientsService);

  // Idempotency: any row in the table short-circuits the seed.
  const [existing] = await database.db.select({ id: clients.id }).from(clients).limit(1);
  if (existing) return;

  for (const row of DEMO_CLIENTS) {
    await service.createWithContacts({
      client: {
        name: row.name,
        legalName: row.legalName,
        taxId: row.taxId,
        email: row.email,
        status: row.status,
        onboardedAt: new Date(`${row.onboardedAt}T00:00:00.000Z`),
      },
      contacts: [
        {
          name: contactNameFromEmail(row.email),
          email: row.email,
          isPrimary: true,
        },
      ],
    });
  }
};
