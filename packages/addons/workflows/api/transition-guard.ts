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
 * The `from`/`to` pair is matched by exact state name; runTransitionGuards
 * filters before invoking. No wildcards in v1.
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
