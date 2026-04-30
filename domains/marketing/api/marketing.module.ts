import { Module } from '@nestjs/common';
import { MonitoringModule } from './monitoring/monitoring.module';

/**
 * Top-level marketing domain module. Composes all feature sub-modules.
 *
 * V1 surface (per domains/marketing/SPEC.md):
 *   - monitoring: sources, keywords, items, pollers
 *   - leads: leads, lead-events, follow-ups (M2)
 *   - templates: outreach templates + variable rendering (M3)
 *   - case-studies: library + snippets (M3)
 *   - digest: 08:00 daily assembly + delivery (M4)
 *   - form-submissions: public capture + lead listener (M5)
 *
 * V2/V3+: composer, publishing, etc.
 */
@Module({
  imports: [MonitoringModule],
  exports: [MonitoringModule],
})
export class MarketingDomainModule {}
