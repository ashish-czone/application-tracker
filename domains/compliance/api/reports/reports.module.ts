import { Module } from '@nestjs/common';
import { ComplianceReportsController } from './reports.controller';
import { ComplianceReportsService } from './reports.service';

@Module({
  controllers: [ComplianceReportsController],
  providers: [ComplianceReportsService],
  exports: [ComplianceReportsService],
})
export class ComplianceReportsModule {}
