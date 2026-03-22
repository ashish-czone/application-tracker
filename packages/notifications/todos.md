# Notifications Package — TODOs

## EAV field conditions in schedule rules

**Status:** Deferred

**Problem:**
Schedule rules evaluate conditions via SQL queries against entity table columns. For EAV (custom) fields stored in `entity_field_values`, the schedule scanner cannot build SQL conditions because:

1. The `entity_field_values` table belongs to `@packages/eav-attributes`
2. Importing eav-attributes schema would create a package dependency — notifications must remain dependency-free
3. The `buildConditions()` function works with Drizzle table column references, which don't exist for EAV fields

**Current behavior:**
- Event-triggered rules: EAV field conditions work via in-memory evaluation against `event.payload.after` (which includes EAV values via `buildSnapshot()`)
- Schedule rules: EAV field conditions are silently skipped (filtered out by `isPayloadCondition` check, and unknown fields are skipped by `buildConditions`)

**Proposed solution:**
Define a `CustomFieldConditionBuilder` interface in the notifications package:

```ts
interface CustomFieldConditionBuilder {
  buildConditions(entityType: string, entityIdColumn: any, conditions: Condition[]): SQL[];
}
```

The schedule scanner optionally receives this via DI. The app layer provides an implementation that uses eav-attributes internally to build EXISTS subqueries against `entity_field_values`. Notifications never imports eav-attributes — it just calls the injected builder.

**Impact:**
Low — schedule rules with conditions on admin-created custom fields won't filter correctly until this is implemented. Standard field conditions and all event-triggered conditions (including EAV) work correctly.
