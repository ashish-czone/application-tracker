import { Module, type OnModuleInit } from '@nestjs/common';
import { WorkflowGuardRegistry } from '@packages/workflows';
import { TemplateProviderRegistry } from '@packages/document-templates';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { NotificationChannelsModule } from '@packages/notification-channels';
import { DatabaseService, eq } from '@packages/database';
import { OfferApprovalsService } from './services/offer-approvals.service';
import { OfferLetterService } from './services/offer-letter.service';
import { OfferApprovalsController } from './controllers/offer-approvals.controller';
import { offers } from './schema/offers';
import { applications } from '../applications/schema/applications';
import { candidates } from '../candidates/schema/candidates';
import { jobOpenings } from '../job-openings/schema/job-openings';
import { formatCurrency } from '@packages/common';

@Module({
  imports: [NotificationChannelsModule],
  controllers: [OfferApprovalsController],
  providers: [OfferApprovalsService, OfferLetterService],
})
export class OffersModule implements OnModuleInit {
  private readonly logger: ContextLogger;

  constructor(
    private readonly guardRegistry: WorkflowGuardRegistry,
    private readonly templateProviderRegistry: TemplateProviderRegistry,
    private readonly approvalsService: OfferApprovalsService,
    private readonly database: DatabaseService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(OffersModule.name);
  }

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
        // Single query with joins instead of N+1 sequential queries
        const [row] = await this.database.db
          .select({
            offer: offers,
            candidateFirstName: candidates.firstName,
            candidateLastName: candidates.lastName,
            candidateEmail: candidates.email,
            jobTitle: jobOpenings.title,
            department: jobOpenings.department,
          })
          .from(offers)
          .leftJoin(applications, eq(applications.id, offers.applicationId))
          .leftJoin(candidates, eq(candidates.id, applications.candidateId))
          .leftJoin(jobOpenings, eq(jobOpenings.id, applications.jobOpeningId))
          .where(eq(offers.id, offerId));

        if (!row) {
          this.logger.warn('Offer not found for template rendering', { offerId });
          return {} as Record<string, string>;
        }

        const { offer } = row;

        return {
          candidateFirstName: row.candidateFirstName ?? '',
          candidateLastName: row.candidateLastName ?? '',
          candidateEmail: row.candidateEmail ?? '',
          jobTitle: row.jobTitle ?? '',
          department: row.department ?? '',
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
