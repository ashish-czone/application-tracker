import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import type { FieldMeta } from '../types';

/**
 * Intercepts entity CRUD requests to enforce field-level permissions.
 *
 * - **Writes** (POST/PATCH): strips fields from request body where the user
 *   lacks the required `writePermission`.
 * - **Reads** (response): strips fields from the response where the user
 *   lacks the required `readPermission`.
 *
 * Fields without readPermission/writePermission are unrestricted —
 * anyone with entity-level access can read/write them.
 *
 * Applied per-entity by the auto-generated controller. The entity's fieldMeta
 * is passed via the factory function, so no runtime registry lookup is needed.
 */
export function createFieldPermissionInterceptor(fieldMeta: Record<string, FieldMeta>) {
  // Pre-compute which fields have permissions so we skip the loop for entities with no restrictions
  const readRestrictedFields = Object.entries(fieldMeta)
    .filter(([, meta]) => meta.readPermission)
    .map(([key, meta]) => ({ key, permission: meta.readPermission! }));

  const writeRestrictedFields = Object.entries(fieldMeta)
    .filter(([, meta]) => meta.writePermission)
    .map(([key, meta]) => ({ key, permission: meta.writePermission! }));

  const hasReadRestrictions = readRestrictedFields.length > 0;
  const hasWriteRestrictions = writeRestrictedFields.length > 0;

  @Injectable()
  class FieldPermissionInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
      // Skip entirely if no field-level permissions are configured
      if (!hasReadRestrictions && !hasWriteRestrictions) {
        return next.handle();
      }

      const request = context.switchToHttp().getRequest();
      const userPermissions: Record<string, string> = request.user?.permissions ?? {};

      // Superadmin bypass — wildcard grants all field permissions
      if ('*' in userPermissions) {
        return next.handle();
      }

      // Strip write-restricted fields from request body
      if (hasWriteRestrictions && request.body && typeof request.body === 'object') {
        for (const { key, permission } of writeRestrictedFields) {
          if (key in request.body && !(permission in userPermissions)) {
            delete request.body[key];
          }
        }
      }

      // Skip read filtering if no read restrictions
      if (!hasReadRestrictions) {
        return next.handle();
      }

      // Strip read-restricted fields from response
      return next.handle().pipe(
        map((response: any) => {
          if (response == null) return response;
          return this.filterResponse(response, userPermissions);
        }),
      );
    }

    private filterResponse(response: any, userPermissions: Record<string, string>): any {
      // Paginated list: { data: [...], meta: {...} }
      if (response.data && Array.isArray(response.data)) {
        return {
          ...response,
          data: response.data.map((item: any) => this.stripFields(item, userPermissions)),
        };
      }

      // Single entity object
      if (typeof response === 'object' && !Array.isArray(response)) {
        return this.stripFields(response, userPermissions);
      }

      return response;
    }

    private stripFields(entity: Record<string, unknown>, userPermissions: Record<string, string>): Record<string, unknown> {
      const result = { ...entity };
      for (const { key, permission } of readRestrictedFields) {
        if (key in result && !(permission in userPermissions)) {
          delete result[key];
        }
      }
      return result;
    }
  }

  return FieldPermissionInterceptor;
}
