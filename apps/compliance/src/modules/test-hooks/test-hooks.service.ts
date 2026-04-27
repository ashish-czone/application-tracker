import { Injectable, Logger, type INestApplicationContext } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { DatabaseService, sql } from '@packages/database';
import type { SeedSource } from '@packages/database/seeder';
import { platformSystemSeedSources } from '@packages/app-shell/seeds';
import { orgUnitsSystemSeedSources } from '@packages/org-units/seeds/system';
import { tasksSystemSeedSources } from '@packages/tasks/seeds/system';
import { notesSystemSeedSources } from '@packages/notes/seeds/system';
import { ScheduleScanner, automationSentLog } from '@packages/automations';
import { gt } from '@packages/database';
import {
  complianceE2eAdminSeedSource,
  complianceSystemSeedSources,
} from '@domains/compliance-api/seeds';
import { ComplianceFilingsGeneratorService } from '@domains/compliance-api/automations/compliance-filings-generator.service';

/**
 * Truncates every data table in the public schema and reruns the
 * minimal "system + e2e-admin" seed set. Designed for the e2e suite's
 * per-spec-file beforeAll, where each spec wants a clean DB but the
 * suite must still authenticate as the seeded e2e-admin.
 *
 * Drizzle migration tables (`__drizzle_migrations__*`) are preserved so
 * the schema itself is not rebuilt on each call.
 */
@Injectable()
export class TestHooksService {
  private readonly logger = new Logger(TestHooksService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async resetState(): Promise<{ durationMs: number; tablesTruncated: number; seedsRun: number }> {
    const startedAt = Date.now();
    const tablesTruncated = await this.truncateAllTables();
    const seedsRun = await this.runResetSeeds();
    const durationMs = Date.now() - startedAt;
    this.logger.log(
      `reset complete: ${tablesTruncated} tables truncated, ${seedsRun} seeds run, ${durationMs}ms`,
    );
    return { durationMs, tablesTruncated, seedsRun };
  }

  /**
   * Run the compliance generator across every active rule with `now=asOf`
   * so the rolling-horizon math, the I6 forward-only filter, and the
   * per-occurrence idempotency guard all evaluate against the injected
   * instant. Returns the count of rows written.
   */
  async runGenerator(asOf: Date): Promise<{ created: number }> {
    const generator = this.moduleRef.get(ComplianceFilingsGeneratorService, { strict: false });
    return generator.generateAll(asOf);
  }

  /**
   * Run the automations schedule scanner with `now=asOf`. Drives every
   * schedule_recurring rule whose `scheduleHour` matches the asOf hour,
   * with date-condition SQL parameterised against asOf rather than wall-
   * clock NOW(). Used to assert escalation (T+0/T+3/T+7) and daily-digest
   * stories deterministically.
   *
   * Returns rows added to `automation_sent_log` during the scan. The log
   * is written synchronously by the scanner (before the action enqueue)
   * so the response is observable without waiting on the queue worker.
   * Each entry proves a (ruleId × entity × targetDate) tuple was matched
   * and queued — the action's side effects (notification dispatch etc.)
   * follow asynchronously and are out of scope for this response.
   */
  async runScheduler(asOf: Date): Promise<{
    fired: Array<{ ruleId: string; entityType: string; entityId: string; targetDate: string }>;
  }> {
    const scanner = this.moduleRef.get(ScheduleScanner, { strict: false });
    // Capture the boundary by sentAt so concurrent test runs don't
    // pollute each other's "fired" list. The unique index on
    // (ruleId, entityType, entityId, targetDate) keeps the row count
    // stable across re-runs of the same scan.
    const boundary = new Date();
    await scanner.scan(asOf);
    const rows = await this.database.db
      .select({
        ruleId: automationSentLog.ruleId,
        entityType: automationSentLog.entityType,
        entityId: automationSentLog.entityId,
        targetDate: automationSentLog.targetDate,
      })
      .from(automationSentLog)
      .where(gt(automationSentLog.sentAt, boundary));
    return { fired: rows };
  }

  private async truncateAllTables(): Promise<number> {
    const result = await this.database.db.execute<{ tablename: string }>(sql`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename NOT LIKE '\\_\\_drizzle\\_migrations\\_\\_%' ESCAPE '\\'
    `);
    if (result.rows.length === 0) return 0;
    const quoted = result.rows.map((r) => `"public"."${r.tablename}"`).join(', ');
    await this.database.db.execute(sql.raw(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`));
    return result.rows.length;
  }

  private async runResetSeeds(): Promise<number> {
    const sources: SeedSource[] = [
      ...platformSystemSeedSources(),
      ...orgUnitsSystemSeedSources(),
      ...tasksSystemSeedSources(),
      ...notesSystemSeedSources(),
      ...complianceSystemSeedSources(),
      complianceE2eAdminSeedSource(),
    ];

    const ctx = this.adaptModuleRefToContext();

    for (const source of sources) {
      const seedFn = await source.load();
      await seedFn(ctx);
    }
    return sources.length;
  }

  private adaptModuleRefToContext(): INestApplicationContext {
    // Seed functions only call `.get(token)`. ModuleRef supports the same
    // call shape but defaults to strict mode (current module only) — we
    // need `strict: false` to resolve providers across the app.
    return {
      get: <T>(token: unknown) => this.moduleRef.get<T>(token as never, { strict: false }),
    } as unknown as INestApplicationContext;
  }
}
