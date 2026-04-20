import { Inject, Injectable, Optional, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import type { EntityConfig } from '../types';
import { EntityRegistryService } from '../entity-registry.service';

/**
 * Restriction-based field permission interceptor.
 *
 * All fields are accessible by default (Read & Write). Restrictions are
 * stored as permission entries on the user's role:
 *
 * - `{slug}.hide-{fieldKey}`     → field is hidden (stripped from reads and writes)
 * - `{slug}.readonly-{fieldKey}` → field is read-only (stripped from writes only)
 *
 * System and required fields cannot be restricted — they always remain Read & Write.
 * Superadmin (wildcard `*` permission) bypasses all restrictions.
 *
 * For extension entities (`extensionOf`), projected parent columns are also
 * gated by the parent's `{parentSlug}.hide-{fieldKey}` /
 * `{parentSlug}.readonly-{fieldKey}` permissions. The single source of truth
 * for a field is the entity that owns it — projecting it into a child does
 * not bypass the parent's RBAC.
 *
 * Applied per-entity by the auto-generated controller.
 */
export function createFieldPermissionInterceptor(config: EntityConfig) {
  const slug = config.slug;

  // Pre-compute which field keys can be restricted (exclude system/required)
  const restrictableFields: string[] = Object.entries(config.fieldMeta)
    .filter(([, meta]) => !meta.isSystem)
    .map(([key]) => key);

  @Injectable()
  class FieldPermissionInterceptor implements NestInterceptor {
    constructor(
      @Optional() @Inject(EntityRegistryService) private readonly entityRegistry?: EntityRegistryService,
    ) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
      const request = context.switchToHttp().getRequest();
      const userPermissions: Record<string, string> = request.user?.permissions ?? {};

      // Superadmin bypass
      if ('*' in userPermissions) {
        return next.handle();
      }

      // Compute hidden and readonly sets for this request
      const hiddenFields = new Set<string>();
      const readonlyFields = new Set<string>();

      for (const fieldKey of restrictableFields) {
        if (`${slug}.hide-${fieldKey}` in userPermissions) {
          hiddenFields.add(fieldKey);
        } else if (`${slug}.readonly-${fieldKey}` in userPermissions) {
          readonlyFields.add(fieldKey);
        }
      }

      // Extension entities: also honor the parent's hide/readonly perms for
      // any column projected into this child. Skipped silently if the
      // registry isn't injected (legacy callers in tests) or finalize hasn't
      // been called yet.
      const ext = this.entityRegistry?.getResolvedExtension(config.entityType);
      if (ext) {
        const parent = this.entityRegistry?.get(ext.parentEntityType);
        if (parent) {
          const parentSlug = parent.slug;
          for (const { fieldKey } of ext.projectedColumns) {
            const meta = parent.fieldMeta[fieldKey];
            if (meta && !meta.isSystem) {
              if (`${parentSlug}.hide-${fieldKey}` in userPermissions) {
                hiddenFields.add(fieldKey);
              } else if (`${parentSlug}.readonly-${fieldKey}` in userPermissions) {
                readonlyFields.add(fieldKey);
              }
            }
          }
        }
      }

      // No restrictions for this user — skip filtering
      if (hiddenFields.size === 0 && readonlyFields.size === 0) {
        return next.handle();
      }

      // Strip hidden + readonly fields from writes
      const writeRestricted = new Set([...hiddenFields, ...readonlyFields]);
      if (writeRestricted.size > 0 && request.body && typeof request.body === 'object') {
        for (const key of writeRestricted) {
          if (key in request.body) {
            delete request.body[key];
          }
        }
      }

      // Strip hidden fields from reads
      if (hiddenFields.size === 0) {
        return next.handle();
      }

      return next.handle().pipe(
        map((response: any) => {
          if (response == null) return response;
          return this.filterResponse(response, hiddenFields);
        }),
      );
    }

    /** @internal */
    filterResponse(response: any, hiddenFields: Set<string>): any {
      if (response.data && Array.isArray(response.data)) {
        return {
          ...response,
          data: response.data.map((item: any) => this.stripFields(item, hiddenFields)),
        };
      }
      if (typeof response === 'object' && !Array.isArray(response)) {
        return this.stripFields(response, hiddenFields);
      }
      return response;
    }

    /** @internal */
    stripFields(entity: Record<string, unknown>, hiddenFields: Set<string>): Record<string, unknown> {
      const result = { ...entity };
      for (const key of hiddenFields) {
        delete result[key];
        delete result[`${key}__label`]; // Also strip resolved lookup labels
      }
      return result;
    }
  }

  return FieldPermissionInterceptor;
}
