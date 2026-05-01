import { Module } from '@nestjs/common';
import { ComplianceFilingsModule } from '../compliance-filings';
import { ComplianceReportsController } from './reports.controller';
import { ComplianceReportsService } from './reports.service';

@Module({
  // Reports applies actor row-level scope on filings via the compliance-filings
  // EntityService — same primitive the engine uses on its CRUD path. Importing
  // the filings module exposes the `ENTITY_SERVICE_compliance-filings` token
  // we inject below.
  imports: [ComplianceFilingsModule],
  controllers: [ComplianceReportsController],
  providers: [ComplianceReportsService],
  exports: [ComplianceReportsService],
})
export class ComplianceReportsModule {}
