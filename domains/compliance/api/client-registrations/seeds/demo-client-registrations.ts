import type { INestApplicationContext } from '@nestjs/common';
import { DatabaseService, isNotNull } from '@packages/database';
import { clients } from '../../clients/clients-ref';
import { complianceClientRegistrations } from '../../schema/client-registrations';
import { ClientRegistrationsService } from '../client-registrations.service';

/**
 * Each demo client registers against a curated mix of laws so the
 * kanban board shows cross-client variety (GST monthly tasks dominate,
 * ITR/ROC appear yearly, TDS quarterly, PT sparsely).
 */
const REGISTRATIONS_BY_CLIENT_NAME: Record<string, string[]> = {
  'Aarav Industries':   ['GST', 'ITR', 'TDS', 'ROC'],
  'Bluewave Exports':   ['GST', 'ITR', 'TDS', 'ROC', 'PT'],
  'Cedar Retail':       ['GST', 'ITR', 'TDS'],
  'Drift Media':        ['GST', 'ITR', 'ROC'],
  'Evergreen Labs':     ['GST', 'ITR', 'TDS', 'ROC'],
  'Fable Studios':      ['GST', 'ITR'],
  'Greenfield Agri':    ['GST', 'ITR', 'PT'],
  'Horizon Pharma':     ['GST', 'ITR', 'TDS', 'ROC', 'PT'],
  'Indigo Logistics':   ['GST', 'ITR', 'TDS', 'ROC'],
  'Jade Constructions': ['GST', 'ITR', 'ROC'],
  'Kite Finserv':       ['GST', 'ITR', 'TDS', 'ROC'],
  'Lumen Tech':         ['GST', 'ITR', 'TDS'],
};

export const seedDemoClientRegistrations = async (
  ctx: INestApplicationContext,
): Promise<void> => {
  const database = ctx.get(DatabaseService);
  const registrationService = ctx.get(ClientRegistrationsService);

  const [existing] = await database.db
    .select({ id: complianceClientRegistrations.id })
    .from(complianceClientRegistrations)
    .limit(1);
  if (existing) return;

  // Scope to compliance clients only — `clients` is the shared `companies`
  // table, so a directory or recruit row by the same name must not match.
  const clientRows = await database.db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(isNotNull(clients.complianceBecameClientAt));
  const clientIdByName = new Map(clientRows.map((c) => [c.name, c.id]));

  for (const [clientName, lawCodes] of Object.entries(REGISTRATIONS_BY_CLIENT_NAME)) {
    const clientId = clientIdByName.get(clientName);
    if (!clientId) continue;
    await registrationService.registerMany(clientId, lawCodes, null);
  }
};
