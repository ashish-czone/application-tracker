import { inArray } from 'drizzle-orm';
import type { INestApplicationContext } from '@nestjs/common';
import { DatabaseService } from '@packages/database';
import { complianceLaws } from './laws.schema';

interface SystemLaw {
  code: string;
  name: string;
  issuingAuthority: string;
  jurisdiction: 'central' | 'state' | 'municipal' | 'international';
  description: string;
}

const SYSTEM_LAWS: SystemLaw[] = [
  {
    code: 'GST',
    name: 'Goods & Services Tax',
    issuingAuthority: 'Central Board of Indirect Taxes and Customs',
    jurisdiction: 'central',
    description:
      'Indirect tax on the supply of goods and services. Monthly/quarterly returns (GSTR-1, GSTR-3B) and annual reconciliation (GSTR-9).',
  },
  {
    code: 'ITR',
    name: 'Income Tax Return',
    issuingAuthority: 'Central Board of Direct Taxes',
    jurisdiction: 'central',
    description:
      'Annual return of income filed by taxpayers declaring taxable income, deductions, and taxes paid.',
  },
  {
    code: 'TDS',
    name: 'Tax Deducted at Source',
    issuingAuthority: 'Central Board of Direct Taxes',
    jurisdiction: 'central',
    description:
      'Tax deducted by the payer at source on specified payments (salary, contractor, rent, etc.) and remitted quarterly via 24Q / 26Q returns.',
  },
  {
    code: 'ROC',
    name: 'Registrar of Companies',
    issuingAuthority: 'Ministry of Corporate Affairs',
    jurisdiction: 'central',
    description:
      'Annual statutory filings for incorporated entities — AOC-4 (financials), MGT-7 (annual return), DIR-3 KYC, and event-based forms.',
  },
  {
    code: 'PT',
    name: 'Professional Tax',
    issuingAuthority: 'State Commercial Tax Department',
    jurisdiction: 'state',
    description:
      'State-level tax on salaried employment and certain professions. Rates and filing cadence vary by state.',
  },
];

export const seedSystemLaws = async (ctx: INestApplicationContext): Promise<void> => {
  const database = ctx.get(DatabaseService);

  const codes = SYSTEM_LAWS.map((l) => l.code);
  const existing = await database.db
    .select({ code: complianceLaws.code })
    .from(complianceLaws)
    .where(inArray(complianceLaws.code, codes));

  const existingCodes = new Set(existing.map((r) => r.code));
  const missing = SYSTEM_LAWS.filter((l) => !existingCodes.has(l.code));
  if (missing.length === 0) return;

  await database.db.insert(complianceLaws).values(
    missing.map((l) => ({
      name: l.name,
      code: l.code,
      issuingAuthority: l.issuingAuthority,
      jurisdiction: l.jurisdiction,
      description: l.description,
    })),
  );
};
