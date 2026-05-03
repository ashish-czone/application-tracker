import { Controller, Get, Header, Injectable, Module, Query, Res, type OnModuleInit } from '@nestjs/common';
import type { Response } from 'express';
import {
  cleanDatabase,
  createTestApp,
  type TestAppContext,
} from '@packages/platform-testing';
import { hierarchyAddon, HierarchyModule } from '@packages/hierarchy';
import { workflowsAddon } from '@packages/workflows';
import { WorkflowsEntityEngineModule } from '@packages/workflows-entity-engine';
import {
  OrgUnitService,
  OrgUnitLevelService,
  OrgPositionService,
  PositionScopeResolverService,
  OrgUnitController,
  OrgUnitLevelController,
  OrgPositionController,
  UnitScopeResolver,
  DescendantsScopeResolver,
  OrgUnitHeadStrategy,
  ParentUnitHeadStrategy,
  OrgUnitMembersStrategy,
  orgUnits,
} from '@packages/org-units';
import { todayInTimezone } from '@packages/common';
import { DatabaseService } from '@packages/database';
import { PdfGeneratorModule, PdfGeneratorService, type PdfProvider } from '@packages/pdf-generator';
import {
  AccessContext,
  PermissionManifestRegistry,
  RequirePermission,
  ScopeResolverRegistry,
  type DataAccessContext,
} from '@packages/rbac';
import { LookupResolverService } from '@packages/entity-engine';
import { UserResolverRegistry, EntityResolverRegistry } from '@packages/automation-contracts';
import { WorkflowRegistryService } from '@packages/workflows';
import {
  ComplianceFilingsModule,
  ComplianceFilingsReportsService,
  csvDisposition,
  pdfDisposition,
  pdfFooterHtml,
  renderTeamWorkloadPdf,
  toCsv,
  type ReportRange,
} from '../../compliance-filings';
import { complianceBackend } from '../../index';

/**
 * Integration-test stub for `PdfProvider`. Returns a fixed buffer that
 * encodes `%PDF-` (the magic bytes a real PDF starts with) followed by
 * the input HTML length, so the tests can assert the controller wired
 * the templating + provider path correctly without requiring Puppeteer
 * or a Chromium binary to be present in CI.
 */
class StubPdfProvider implements PdfProvider {
  async generatePdf(html: string): Promise<Buffer> {
    const header = Buffer.from('%PDF-1.4\n');
    const body = Buffer.from(`html-length=${html.length}`);
    return Buffer.concat([header, body]);
  }
}

/**
 * Test-side mirror of `apps/compliance/src/modules/org-units/org-units.module.ts`.
 * No `@Global()` and no `TASK_TEAM_MEMBERS_READER` binding: TasksModule is no
 * longer loaded in compliance (the domain doesn't inject `TasksService`), so
 * the token isn't needed in this test app.
 *
 * Defined before TestOrgUnitsReportsModule (which imports it for
 * OrgUnitService) to avoid TDZ initialization order issues.
 */
@Module({
  controllers: [OrgUnitController, OrgUnitLevelController, OrgPositionController],
  providers: [
    OrgUnitService,
    OrgUnitLevelService,
    OrgPositionService,
    PositionScopeResolverService,
    UnitScopeResolver,
    DescendantsScopeResolver,
  ],
  exports: [
    OrgUnitService,
    OrgUnitLevelService,
    OrgPositionService,
    PositionScopeResolverService,
  ],
})
class TestOrgUnitsModule implements OnModuleInit {
  constructor(
    private readonly manifestRegistry: PermissionManifestRegistry,
    private readonly lookupResolver: LookupResolverService,
    private readonly userResolverRegistry: UserResolverRegistry,
    private readonly entityResolverRegistry: EntityResolverRegistry,
    private readonly database: DatabaseService,
    private readonly scopeResolverRegistry: ScopeResolverRegistry,
    private readonly unitScopeResolver: UnitScopeResolver,
    private readonly descendantsScopeResolver: DescendantsScopeResolver,
  ) {}

  onModuleInit() {
    this.manifestRegistry.registerMany([
      { slug: 'org-units.read',   module: 'org-units', action: 'read',   label: 'View org units',   description: 'View org units',                       supportedScopes: ['any'] },
      { slug: 'org-units.manage', module: 'org-units', action: 'manage', label: 'Manage org units', description: 'Create, update, and delete org units', supportedScopes: ['any'] },
    ]);
    this.scopeResolverRegistry.register(this.unitScopeResolver);
    this.scopeResolverRegistry.register(this.descendantsScopeResolver);
    this.lookupResolver.register({
      entity: 'org-units',
      table: orgUnits,
      labelField: 'name',
      valueField: 'id',
      searchFields: ['name'],
    });
    const getResolver = (entityType: string) => this.entityResolverRegistry.get(entityType);
    this.userResolverRegistry.registerStrategy(new OrgUnitHeadStrategy(this.database, getResolver));
    this.userResolverRegistry.registerStrategy(new ParentUnitHeadStrategy(this.database, getResolver));
    this.userResolverRegistry.registerStrategy(new OrgUnitMembersStrategy(this.database, getResolver));
  }
}

/**
 * Test-side mirror of `apps/compliance/src/modules/org-units/org-units.reports.service.ts`.
 * Composes per-team filings counts (from the compliance domain) with
 * team names (from `OrgUnitService`) into the team-workload row shape.
 * Mirrors the runtime app service so the team-workload integration
 * tests exercise the same composition path as production. Drift between
 * this and the runtime version surfaces as a test failure.
 */
interface TestTeamWorkloadRow {
  assigneeTeamId: string;
  assigneeTeamName: string;
  totalAssigned: number;
  completed: number;
  inProgress: number;
  overdue: number;
  onTimeRate: number;
}

@Injectable()
class TestOrgUnitsReportsService {
  constructor(
    private readonly orgUnits: OrgUnitService,
    private readonly filingsReports: ComplianceFilingsReportsService,
  ) {}

  async getTeamWorkload(
    range: ReportRange,
    today: string,
    options?: { q?: string },
    accessCtx?: DataAccessContext,
  ): Promise<TestTeamWorkloadRow[]> {
    const counts = await this.filingsReports.getCountsByTeam(range, today, accessCtx);
    const allUnits = await this.orgUnits.findAll();
    const nameById = new Map(allUnits.map((u) => [u.id, u.name]));
    const q = options?.q?.trim().toLowerCase() ?? '';
    return counts.flatMap<TestTeamWorkloadRow>((row) => {
      const teamName = nameById.get(row.assigneeTeamId) ?? '';
      if (q.length > 0 && !teamName.toLowerCase().includes(q)) return [];
      const sum = row.onTime + row.late;
      return [{
        assigneeTeamId: row.assigneeTeamId,
        assigneeTeamName: teamName,
        totalAssigned: row.totalAssigned,
        completed: row.completed,
        inProgress: row.inProgress,
        overdue: row.overdue,
        onTimeRate: sum > 0 ? Math.round((row.onTime / sum) * 100) : 0,
      }];
    });
  }
}

/**
 * Test-side mirror of `apps/compliance/src/modules/org-units/org-units.reports.controller.ts`.
 * Domains can't import from apps (per dependency-direction.md), so the
 * cross-domain workload endpoint is replicated here. The route shape,
 * permission slug, query params, and CSV / PDF builders match the
 * runtime controller — drift surfaces as a test failure.
 */
const REPORTS_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function reportsResolveCalendarDate(input: string | undefined, fallback: string): string {
  return input && REPORTS_DATE_RE.test(input) ? input : fallback;
}
function reportsResolveToday(): string {
  return todayInTimezone(process.env.APP_TIMEZONE ?? 'UTC');
}
function reportsDefaultRange(today: string): { from: string; to: string } {
  const [y, m, d] = today.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCMonth(dt.getUTCMonth() - 5);
  dt.setUTCDate(1);
  const from = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-01`;
  return { from, to: today };
}

@Controller('org-units/reports')
class TestOrgUnitsReportsController {
  constructor(
    private readonly reports: TestOrgUnitsReportsService,
    private readonly pdfGenerator: PdfGeneratorService,
  ) {}

  @Get('team-workload')
  @RequirePermission('reports.read')
  getTeamWorkload(
    @Query('from') fromParam: string | undefined,
    @Query('to') toParam: string | undefined,
    @Query('today') todayParam: string | undefined,
    @Query('q') q: string | undefined,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const today = reportsResolveCalendarDate(todayParam, reportsResolveToday());
    const range = reportsDefaultRange(today);
    const from = reportsResolveCalendarDate(fromParam, range.from);
    const to = reportsResolveCalendarDate(toParam, range.to);
    return this.reports.getTeamWorkload({ from, to }, today, { q }, accessCtx);
  }

  @Get('team-workload.csv')
  @RequirePermission('reports.read')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async getTeamWorkloadCsv(
    @Res() res: Response,
    @Query('from') fromParam: string | undefined,
    @Query('to') toParam: string | undefined,
    @Query('today') todayParam: string | undefined,
    @Query('q') q: string | undefined,
    @AccessContext() accessCtx?: DataAccessContext,
  ): Promise<void> {
    const today = reportsResolveCalendarDate(todayParam, reportsResolveToday());
    const range = reportsDefaultRange(today);
    const from = reportsResolveCalendarDate(fromParam, range.from);
    const to = reportsResolveCalendarDate(toParam, range.to);

    const rows = await this.reports.getTeamWorkload({ from, to }, today, { q }, accessCtx);
    const csv = toCsv(
      ['Team ID', 'Team', 'Total Assigned', 'Completed', 'In Progress', 'Overdue', 'On-Time Rate (%)'],
      rows.map((r) => [
        r.assigneeTeamId,
        r.assigneeTeamName,
        r.totalAssigned,
        r.completed,
        r.inProgress,
        r.overdue,
        r.onTimeRate,
      ]),
    );

    res.setHeader('Content-Disposition', csvDisposition('workload', today));
    res.send(csv);
  }

  @Get('team-workload.pdf')
  @RequirePermission('reports.read')
  @Header('Content-Type', 'application/pdf')
  async getTeamWorkloadPdf(
    @Res() res: Response,
    @Query('from') fromParam: string | undefined,
    @Query('to') toParam: string | undefined,
    @Query('today') todayParam: string | undefined,
    @Query('q') q: string | undefined,
    @AccessContext() accessCtx?: DataAccessContext,
  ): Promise<void> {
    const today = reportsResolveCalendarDate(todayParam, reportsResolveToday());
    const range = reportsDefaultRange(today);
    const from = reportsResolveCalendarDate(fromParam, range.from);
    const to = reportsResolveCalendarDate(toParam, range.to);

    const rows = await this.reports.getTeamWorkload({ from, to }, today, { q }, accessCtx);
    const html = renderTeamWorkloadPdf({ rows, range: { from, to }, today });
    const pdfBuffer = await this.pdfGenerator.generatePdf(html, {
      format: 'A4',
      landscape: false,
      printBackground: true,
      footerHtml: pdfFooterHtml(),
    });

    res.setHeader('Content-Disposition', pdfDisposition('workload', today));
    res.send(pdfBuffer);
  }
}

@Module({
  // Imports both the in-domain ComplianceFilingsModule (provides
  // ComplianceFilingsReportsService) and the test-side TestOrgUnitsModule
  // (provides OrgUnitService) — same composition pattern as the runtime
  // app's OrgUnitsModule.
  imports: [ComplianceFilingsModule, TestOrgUnitsModule],
  controllers: [TestOrgUnitsReportsController],
  providers: [TestOrgUnitsReportsService],
})
class TestOrgUnitsReportsModule {}

/**
 * Boots a NestJS HTTP test app with the compliance domain wired up against
 * real Postgres. Uses `createTestApp` from `@packages/platform-testing` which
 * mirrors the shell composition `apps/compliance` uses at runtime — same
 * EntityEngineModule, WorkflowsModule, AuditModule, etc. — so domain code
 * resolves the same DI graph in tests as in production.
 *
 * `extraImports` mirrors what `apps/compliance/src/app.module.ts` passes to
 * `createAppModule`, scoped down to what compliance integration tests
 * actually exercise:
 *  - `HierarchyModule` for laws (laws are hierarchical via the platform flag)
 *  - `TestOrgUnitsModule` for assigneeTeamId and escalation resolvers.
 *    UsersModule is intentionally omitted — compliance only uses the
 *    `USERS_POSITIONS_READER` token, which it provides itself.
 */
export async function createComplianceTestApp(): Promise<TestAppContext> {
  return createTestApp({
    domains: [complianceBackend],
    addons: [workflowsAddon, hierarchyAddon],
    // PdfGeneratorModule is wired with a stub provider so the report
    // PDF endpoints can resolve PdfGeneratorService without requiring
    // Puppeteer / Chromium in CI. The runtime app uses the real
    // PuppeteerPdfProvider; tests assert only that the controller
    // wired the templating + provider path correctly (Content-Type,
    // Content-Disposition, scope passthrough), not the bytes Puppeteer
    // produces.
    extraImports: [
      WorkflowsEntityEngineModule,
      TestOrgUnitsModule,
      // PdfGeneratorModule is registered before TestOrgUnitsReportsModule
      // so the test reports controller can inject PdfGeneratorService.
      PdfGeneratorModule.register({ provider: new StubPdfProvider() }),
      TestOrgUnitsReportsModule,
    ],
  });
}

/**
 * Truncates all tables. Use in `beforeEach` so each test starts from a
 * clean DB.
 *
 * Compliance's workflow definitions are code-defined (registered via
 * `WorkflowsModule.forFeature(...)` at module init) and live in the
 * `WorkflowRegistryService` in-memory cache for the lifetime of the test
 * app. They survive `cleanDatabase` because they are never DB rows.
 * `loadAll()` is still called so any admin-defined workflows the test
 * created itself are dropped from the cache before the next test runs.
 */
export async function resetComplianceTestDb(ctx: TestAppContext): Promise<void> {
  await cleanDatabase(ctx.db);
  const workflowRegistry = ctx.module.get(WorkflowRegistryService);
  await workflowRegistry.loadAll();
}
