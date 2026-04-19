import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import type { INestApplicationContext } from '@nestjs/common';
import { DatabaseService } from '@packages/database';
import { computePath, computeDepth } from '@packages/hierarchy';
import { complianceLaws } from '../../schema/laws';

interface DemoLawNode {
  code: string;
  name: string;
  jurisdiction: 'central' | 'state' | 'municipal' | 'international';
  effectiveFrom?: string;
  issuingAuthority?: string;
  description?: string;
  children?: DemoLawNode[];
}

const DEMO_LAW_TREE: DemoLawNode = {
  code: 'CO-2013',
  name: 'Companies Act 2013',
  jurisdiction: 'central',
  effectiveFrom: '2013-08-30',
  issuingAuthority: 'Ministry of Corporate Affairs',
  description:
    'An Act to consolidate and amend the law relating to companies in India. Demo data — chapters and sections illustrate the hierarchy.',
  children: [
    {
      code: 'CO-2013-CH-IX',
      name: 'Chapter IX — Accounts of Companies',
      jurisdiction: 'central',
      children: [
        {
          code: 'CO-2013-S-129',
          name: 'Section 129 — Financial Statement',
          jurisdiction: 'central',
          effectiveFrom: '2014-04-01',
        },
        {
          code: 'CO-2013-S-134',
          name: 'Section 134 — Financial statement, Board’s report, etc.',
          jurisdiction: 'central',
          effectiveFrom: '2014-04-01',
        },
        {
          code: 'CO-2013-S-137',
          name: 'Section 137 — Copy of financial statement to be filed with Registrar',
          jurisdiction: 'central',
          effectiveFrom: '2014-04-01',
        },
      ],
    },
    {
      code: 'CO-2013-CH-X',
      name: 'Chapter X — Audit and Auditors',
      jurisdiction: 'central',
      children: [
        {
          code: 'CO-2013-S-139',
          name: 'Section 139 — Appointment of auditors',
          jurisdiction: 'central',
          effectiveFrom: '2014-04-01',
        },
        {
          code: 'CO-2013-S-143',
          name: 'Section 143 — Powers and duties of auditors',
          jurisdiction: 'central',
          effectiveFrom: '2014-04-01',
        },
      ],
    },
  ],
};

export const seedDemoLaws = async (ctx: INestApplicationContext): Promise<void> => {
  const database = ctx.get(DatabaseService);

  // Idempotency: presence of the root demo Act short-circuits the seed.
  const [existing] = await database.db
    .select({ id: complianceLaws.id })
    .from(complianceLaws)
    .where(eq(complianceLaws.code, DEMO_LAW_TREE.code))
    .limit(1);
  if (existing) return;

  const insertNode = async (
    node: DemoLawNode,
    parentId: string | null,
    parentPath: string | null,
  ): Promise<void> => {
    const id = randomUUID();
    const path = computePath(parentPath, id);
    const depth = computeDepth(path);
    await database.db.insert(complianceLaws).values({
      id,
      parentId: parentId ?? null,
      path,
      depth,
      name: node.name,
      code: node.code,
      jurisdiction: node.jurisdiction,
      effectiveFrom: node.effectiveFrom ?? null,
      issuingAuthority: node.issuingAuthority ?? null,
      description: node.description ?? null,
    });
    for (const child of node.children ?? []) {
      await insertNode(child, id, path);
    }
  };

  await insertNode(DEMO_LAW_TREE, null, null);
};
