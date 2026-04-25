import { Logger } from '@nestjs/common';
import { getTableColumns } from 'drizzle-orm';
import { fieldTypeRegistry } from '@packages/field-types';
import type { FieldDefinitionService } from './services/field-definition.service';
import type { LayoutExtension } from './extensions/layout-extension.interface';
import type { FieldType, RegisterFieldInput } from './types';
import type { WorkflowExtension } from './extensions/workflow-extension.interface';
import type { EntityConfig, WorkflowTargetDef } from './types';

const seedLogger = new Logger('SeedEntityFields');

/** Map Drizzle column dataType to EAV FieldType. */
function mapDrizzleType(dataType: string): FieldType {
  switch (dataType) {
    case 'string': return 'text';
    case 'number': return 'number';
    case 'boolean': return 'boolean';
    case 'date': return 'date';
    default: return 'text';
  }
}

/**
 * Seeds field definitions, picklist options, and default layout for an entity.
 *
 * Registers all fields from `fieldMeta` plus implicit system fields (createdAt,
 * updatedAt, createdBy). Only `id` and soft-delete columns are skipped — they
 * are pure infrastructure with no user-facing meaning.
 *
 * Fields in `fieldMeta` that have a matching Drizzle column get `columnName` set.
 * Fields in `fieldMeta` without a matching column are registered as virtual/EAV fields
 * (rich_text, tags, file, category, multi_user, multi_lookup, or custom EAV fields).
 *
 * This is idempotent — safe to call on every app startup.
 */
export async function seedEntityFields(
  config: EntityConfig,
  fieldDefinitionService: FieldDefinitionService,
  layoutExtension: LayoutExtension | null,
): Promise<void> {
  // Skip infrastructure columns + computed columns (SQL subqueries, not real fields)
  const skipSet = new Set(['id', 'deletedAt', 'deletedBy']);
  for (const col of config.computedColumns ?? []) {
    skipSet.add(col.name);
  }
  const columns = getTableColumns(config.table);
  const columnMap = new Map(Object.entries(columns));

  const fields: RegisterFieldInput[] = [];
  const seenKeys = new Set<string>();

  for (const [key, meta] of Object.entries(config.fieldMeta)) {
    if (skipSet.has(key)) continue;
    seenKeys.add(key);

    const col = columnMap.get(key);

    // Warn if a non-relational field has no DB column but customFields is disabled
    if (!col && !config.customFields) {
      const ft = meta.fieldType ?? 'text';
      if (!fieldTypeRegistry.isRelational(ft)) {
        seedLogger.warn(
          `Entity '${config.entityType}' field '${key}' (${ft}) has no DB column but customFields is not enabled. ` +
          `This field will not be stored. Either add a DB column or set customFields: true.`,
        );
      }
    }

    fields.push({
      fieldKey: key,
      label: meta.label,
      fieldType: meta.fieldType ?? (col ? mapDrizzleType(col.dataType) : 'text'),
      columnName: col?.name ?? undefined, // undefined for virtual/EAV-only fields
      isRequired: col?.notNull ?? false,
      isSystem: meta.isSystem ?? false,
      isUnique: meta.isUnique ?? false,
      isQuickCreate: meta.isQuickCreate ?? false,
      isReadonly: meta.isReadonly ?? false,
      maxLength: meta.maxLength ?? undefined,
      defaultValue: meta.defaultValue ?? undefined,
      uiType: meta.uiType ?? undefined,
      lookupEntity: meta.lookupEntity ?? undefined,
      lookupLabelField: meta.lookupLabelField ?? undefined,
      lookupSearchFields: meta.lookupSearchFields ?? undefined,
      tagGroupSlug: meta.tagGroupSlug ?? undefined,
      categoryGroupSlug: meta.categoryGroupSlug ?? undefined,
      fileAccept: meta.accept ?? undefined,
      fileMaxSize: meta.maxFileSize ?? undefined,
      sortOrder: meta.sortOrder,
    });
  }

  // Seed implicit system fields (createdAt, updatedAt, createdBy) if not already
  // defined in fieldMeta. These are useful for filtering and automation conditions.
  // Only seeded if the corresponding DB column exists on the entity table.
  const implicitFields: { key: string; label: string; fieldType: FieldType }[] = [
    { key: 'createdBy', label: 'Created By', fieldType: 'user' },
    { key: 'createdAt', label: 'Created At', fieldType: 'datetime' },
    { key: 'updatedAt', label: 'Updated At', fieldType: 'datetime' },
  ];

  for (const implicit of implicitFields) {
    if (seenKeys.has(implicit.key)) continue;
    const col = columnMap.get(implicit.key);
    if (!col) continue;

    fields.push({
      fieldKey: implicit.key,
      label: implicit.label,
      fieldType: implicit.fieldType,
      columnName: col.name,
      isRequired: false,
      isSystem: true,
      isUnique: false,
      isQuickCreate: false,
      isReadonly: true,
      sortOrder: 9000 + fields.length,
    });
  }

  // Register all fields (idempotent upsert)
  await fieldDefinitionService.registerStandardFields(config.entityType, fields);

  // Set picklist options for fields that have them
  for (const [fieldKey, meta] of Object.entries(config.fieldMeta)) {
    if (meta.picklistOptions && meta.picklistOptions.length > 0) {
      await fieldDefinitionService.setPicklistOptions(
        config.entityType,
        fieldKey,
        meta.picklistOptions.map((opt, i) => ({
          label: opt.label,
          value: opt.value,
          isDefault: opt.isDefault,
          sortOrder: i,
        })),
      );
    }
  }

  // Seed default layout sections (only if layout extension is available)
  if (layoutExtension && config.sections.length > 0) {
    await layoutExtension.seedDefaultLayout(config.entityType, config.sections);
  }
}

/**
 * Seeds workflow definitions, states, and transitions from fieldMeta.
 * Idempotent — skips workflows that already exist (by slug).
 */
export async function seedWorkflows(
  config: EntityConfig,
  workflowExt: WorkflowExtension,
): Promise<void> {
  for (const [fieldKey, meta] of Object.entries(config.fieldMeta)) {
    if (meta.fieldType !== 'workflow' || !meta.workflow) continue;

    const wf = meta.workflow;

    // Skip if already seeded
    const existing = workflowExt.getBySlug(wf.slug);
    if (existing) continue;

    // Create definition
    const definition = await workflowExt.createDefinition({
      slug: wf.slug,
      name: `${meta.label} Workflow`,
      entityType: config.entityType,
      fieldName: fieldKey,
      initialState: wf.initialState,
    });

    // Create states
    const stateIdByName = new Map<string, string>();
    for (let i = 0; i < wf.states.length; i++) {
      const s = wf.states[i];
      const state = await workflowExt.createState(definition.id, {
        name: s.name,
        label: s.label,
        color: s.color,
        sortOrder: i,
      });
      stateIdByName.set(s.name, state.id);
    }

    // Create transitions — flatten { from, to: [...] } into individual rows
    for (const transition of wf.transitions) {
      const fromStateId = stateIdByName.get(transition.from);
      if (!fromStateId) continue;

      for (let i = 0; i < transition.to.length; i++) {
        const target = transition.to[i];
        const isString = typeof target === 'string';
        const targetName = isString ? target : (target as WorkflowTargetDef).state;
        const targetDef = isString ? undefined : (target as WorkflowTargetDef);

        const toStateId = stateIdByName.get(targetName);
        if (!toStateId) continue;

        // Auto-derive transition name from target state label
        const targetState = wf.states.find(s => s.name === targetName);
        const name = targetState?.label ?? targetName;

        await workflowExt.createTransition(definition.id, {
          fromStateId,
          toStateId,
          name,
          requiredPermissions: targetDef?.requiredPermissions,
          sortOrder: i,
          metadata: targetDef?.conditions ? { conditions: targetDef.conditions } : undefined,
          reasonRequired: targetDef?.reasonRequired,
          commentRequired: targetDef?.commentRequired,
          reasonOptions: targetDef?.reasonOptions,
        });
      }
    }
  }
}
