import { Module, type OnModuleInit } from '@nestjs/common';
import { WorkflowGuardRegistry } from '@packages/workflows';
import { TemplateProviderRegistry } from '@packages/document-templates';
import { DatabaseService, eq } from '@packages/database';
import { OfferApprovalsService } from './services/offer-approvals.service';
import { OfferApprovalsController } from './controllers/offer-approvals.controller';
import { offers } from './schema/offers';
import { formatCurrency } from '@packages/common';

@Module({
  controllers: [OfferApprovalsController],
  providers: [OfferApprovalsService],
})
export class OffersModule implements OnModuleInit {
  constructor(
    private readonly guardRegistry: WorkflowGuardRegistry,
    private readonly templateProviderRegistry: TemplateProviderRegistry,
    private readonly approvalsService: OfferApprovalsService,
    private readonly database: DatabaseService,
  ) {}

  onModuleInit() {
    // Register guard: blocks pending-approval → approved unless all approvers approved
    this.guardRegistry.register('require-offer-approvals', async (ctx) => {
      if (ctx.entityType !== 'offers') return true;
      if (ctx.toState !== 'approved') return true;
      return this.approvalsService.allApproved(ctx.entityId);
    });

    // Register offer-letter template placeholder provider
    this.templateProviderRegistry.register({
      category: 'offer-letter',
      getPlaceholders: () => [
        { key: 'candidateFirstName', label: 'Candidate First Name', sampleValue: 'Jane' },
        { key: 'candidateLastName', label: 'Candidate Last Name', sampleValue: 'Smith' },
        { key: 'candidateEmail', label: 'Candidate Email', sampleValue: 'jane.smith@example.com' },
        { key: 'jobTitle', label: 'Job Title', sampleValue: 'Senior Software Engineer' },
        { key: 'department', label: 'Department', sampleValue: 'Engineering' },
        { key: 'salary', label: 'Salary', sampleValue: '$125,000' },
        { key: 'salaryCurrency', label: 'Salary Currency', sampleValue: 'USD' },
        { key: 'salaryPeriod', label: 'Salary Period', sampleValue: 'Annual' },
        { key: 'signingBonus', label: 'Signing Bonus', sampleValue: '$10,000' },
        { key: 'equity', label: 'Equity', sampleValue: '0.1% vesting over 4 years' },
        { key: 'startDate', label: 'Start Date', sampleValue: '2026-05-01' },
        { key: 'expiresAt', label: 'Offer Expires', sampleValue: '2026-04-20' },
        { key: 'companyName', label: 'Company Name', sampleValue: 'Acme Corp' },
        { key: 'currentDate', label: 'Current Date', sampleValue: new Date().toISOString().split('T')[0] },
      ],
      resolve: async (offerId: string): Promise<Record<string, string>> => {
        // Fetch offer
        const [offer] = await this.database.db
          .select()
          .from(offers)
          .where(eq(offers.id, offerId));
        if (!offer) return {} as Record<string, string>;

        // Fetch application → candidate + job opening via entity engine lookups
        const { apiFn } = this as any;
        let candidateFirstName = '';
        let candidateLastName = '';
        let candidateEmail = '';
        let jobTitle = '';
        let department = '';

        try {
          // Use raw DB queries to resolve related entities
          const { applications } = await import('../applications/schema/applications');
          const [app] = await this.database.db
            .select()
            .from(applications)
            .where(eq(applications.id, offer.applicationId));

          if (app) {
            const { candidates } = await import('../candidates/schema/candidates');
            const [candidate] = await this.database.db
              .select()
              .from(candidates)
              .where(eq(candidates.id, app.candidateId));
            if (candidate) {
              candidateFirstName = (candidate as any).firstName ?? '';
              candidateLastName = (candidate as any).lastName ?? '';
              candidateEmail = (candidate as any).email ?? '';
            }

            const { jobOpenings } = await import('../job-openings/schema/job-openings');
            const [job] = await this.database.db
              .select()
              .from(jobOpenings)
              .where(eq(jobOpenings.id, app.jobOpeningId));
            if (job) {
              jobTitle = (job as any).title ?? '';
              department = (job as any).department ?? '';
            }
          }
        } catch {
          // Related entities may not exist
        }

        return {
          candidateFirstName,
          candidateLastName,
          candidateEmail,
          jobTitle,
          department,
          salary: offer.salary ? formatCurrency(offer.salary) : '',
          salaryCurrency: offer.salaryCurrency ?? '',
          salaryPeriod: offer.salaryPeriod ?? '',
          signingBonus: offer.signingBonus ? formatCurrency(offer.signingBonus) : '',
          equity: offer.equity ?? '',
          startDate: offer.startDate ?? '',
          expiresAt: offer.expiresAt ?? '',
          companyName: process.env.COMPANY_NAME ?? 'Our Company',
          currentDate: new Date().toISOString().split('T')[0],
        };
      },
    });
  }
}
