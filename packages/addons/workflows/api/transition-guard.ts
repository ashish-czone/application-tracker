/**
 * Declarative guard rows owned by per-entity services.
 *
 * Mental model: Django `Model.clean()` — the entity service knows what gates
 * its own transitions. The platform engine validates state-machine legality,
 * permissions, conditions, write/history/event; the per-entity service runs
 * its own guards before calling into the engine.
 *
 * Each guard returns:
 *   - `void` (or `undefined`) — allow
 *   - a `string`              — allow with a warning surfaced to the UI
 *   - throw                   — block (typically UnprocessableEntityException)
 *
 * The `from`/`to` pair is matched by exact state name; runners filter before
 * invoking. No wildcards in v1.
 */
export interface TransitionGuard<TEntity, TDeps = unknown> {
  name: string;
  from: string;
  to: string;
  check: (entity: TEntity, ctx: GuardCtx<TDeps>) => Promise<string | void>;
}

export interface GuardCtx<TDeps> {
  fromState: string;
  toState: string;
  actor: string | null;
  deps: TDeps;
  metadata?: Record<string, unknown>;
}

export interface GuardOutcome {
  warnings: string[];
  blockers: string[];
}

/**
 * Commit-mode runner: executes matching guards in declaration order. The
 * first guard that throws short-circuits the rest — its exception propagates
 * to the caller (the entity service typically wraps blocking errors in
 * UnprocessableEntityException). Returns warnings on success.
 */
export async function runTransitionGuards<TEntity, TDeps>(
  guards: TransitionGuard<TEntity, TDeps>[],
  entity: TEntity,
  ctx: GuardCtx<TDeps>,
): Promise<string[]> {
  const warnings: string[] = [];
  for (const guard of guards) {
    if (guard.from !== ctx.fromState || guard.to !== ctx.toState) continue;
    const result = await guard.check(entity, ctx);
    if (typeof result === 'string') warnings.push(result);
  }
  return warnings;
}

/**
 * Preview-mode runner: executes every matching guard, catching thrown errors
 * and accumulating their messages as blockers rather than short-circuiting.
 * The UI preflight banner uses this to surface every problem at once.
 */
export async function previewTransitionGuards<TEntity, TDeps>(
  guards: TransitionGuard<TEntity, TDeps>[],
  entity: TEntity,
  ctx: GuardCtx<TDeps>,
): Promise<GuardOutcome> {
  const warnings: string[] = [];
  const blockers: string[] = [];
  for (const guard of guards) {
    if (guard.from !== ctx.fromState || guard.to !== ctx.toState) continue;
    try {
      const result = await guard.check(entity, ctx);
      if (typeof result === 'string') warnings.push(result);
    } catch (err) {
      blockers.push(err instanceof Error ? err.message : String(err));
    }
  }
  return { warnings, blockers };
}
