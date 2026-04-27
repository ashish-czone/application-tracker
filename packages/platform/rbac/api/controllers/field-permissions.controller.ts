import { Controller, Get, Put, Param, Body, ParseUUIDPipe, NotFoundException, Inject, Optional } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { RbacService } from '../services/rbac.service';
import type { FieldPermissionEntityResolver } from '../types';
import { FIELD_PERMISSION_ENTITY_RESOLVER } from '../types';

type FieldAccess = 'read_write' | 'read_only' | 'hidden';

interface FieldPermissionEntry {
  fieldKey: string;
  label: string;
  fieldType: string;
  isSystem: boolean;
  isRequired: boolean;
  access: FieldAccess;
}

interface SetFieldPermissionsBody {
  fields: { fieldKey: string; access: FieldAccess }[];
}

interface FieldDefinitionLike {
  fieldKey: string;
  label: string;
  fieldType: string;
  isSystem: boolean;
  isRequired: boolean;
}

interface FieldDefinitionServiceLike {
  listByEntity(entityType: string): Promise<FieldDefinitionLike[]>;
}

export const FIELD_DEFINITION_SERVICE_TOKEN = 'FIELD_DEFINITION_SERVICE';

/**
 * Field-level permission management per role per entity.
 *
 * Convention: restrictions are stored as permission entries on the role:
 * - {slug}.hide-{fieldKey}     → field hidden
 * - {slug}.readonly-{fieldKey} → field read-only
 * - No entry                   → field is read & write (default)
 */
@ApiTags('field-permissions')
@Controller('field-permissions')
export class FieldPermissionsController {
  constructor(
    private readonly rbacService: RbacService,
    @Inject(FIELD_DEFINITION_SERVICE_TOKEN) private readonly fieldDefinitionService: FieldDefinitionServiceLike,
    @Optional() @Inject(FIELD_PERMISSION_ENTITY_RESOLVER) private readonly entityResolver?: FieldPermissionEntityResolver,
  ) {}

  @Get('roles/:roleId/entities/:entityType')
  @RequirePermission('rbac.roles.read')
  @ApiOperation({ summary: 'Get field permissions for a role + entity' })
  async getFieldPermissions(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Param('entityType') entityType: string,
  ): Promise<FieldPermissionEntry[]> {
    const entityMeta = this.entityResolver?.resolve(entityType);
    if (!entityMeta) throw new NotFoundException(`Entity type '${entityType}' not found`);

    await this.rbacService.findRoleByIdOrFail(roleId);
    const rolePerms = await this.rbacService.getRolePermissions(roleId);
    const permSet = new Set(Object.keys(rolePerms));

    const fields = await this.fieldDefinitionService.listByEntity(entityType);

    return fields.map((field) => {
      const meta = entityMeta.fieldMeta[field.fieldKey];
      const isSystem = meta?.isSystem ?? field.isSystem;
      const isRequired = field.isRequired;

      let access: FieldAccess = 'read_write';
      if (!isSystem) {
        if (permSet.has(`${entityMeta.slug}.hide-${field.fieldKey}`)) {
          access = 'hidden';
        } else if (permSet.has(`${entityMeta.slug}.readonly-${field.fieldKey}`)) {
          access = 'read_only';
        }
      }

      return {
        fieldKey: field.fieldKey,
        label: field.label,
        fieldType: field.fieldType,
        isSystem,
        isRequired,
        access,
      };
    });
  }

  @Put('roles/:roleId/entities/:entityType')
  @RequirePermission('rbac.roles-manage')
  @ApiOperation({ summary: 'Set field permissions for a role + entity' })
  async setFieldPermissions(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Param('entityType') entityType: string,
    @Body() body: SetFieldPermissionsBody,
  ): Promise<FieldPermissionEntry[]> {
    const entityMeta = this.entityResolver?.resolve(entityType);
    if (!entityMeta) throw new NotFoundException(`Entity type '${entityType}' not found`);

    await this.rbacService.findRoleByIdOrFail(roleId);

    const existingPerms = await this.rbacService.getRolePermissions(roleId);

    const hidePrefix = `${entityMeta.slug}.hide-`;
    const readonlyPrefix = `${entityMeta.slug}.readonly-`;

    const updatedList: { name: string }[] = [];

    // Keep existing permissions that aren't field restrictions for this entity
    for (const perm of Object.keys(existingPerms)) {
      if (!perm.startsWith(hidePrefix) && !perm.startsWith(readonlyPrefix)) {
        updatedList.push({ name: perm });
      }
    }

    // Add new restriction entries from the matrix. Field perms are boolean —
    // they are gated by key presence, so no scopes are attached (defaults to
    // unrestricted when persisted).
    for (const { fieldKey, access } of body.fields) {
      const meta = entityMeta.fieldMeta[fieldKey];
      if (meta?.isSystem) continue;

      if (access === 'hidden') {
        updatedList.push({ name: `${entityMeta.slug}.hide-${fieldKey}` });
      } else if (access === 'read_only') {
        updatedList.push({ name: `${entityMeta.slug}.readonly-${fieldKey}` });
      }
    }

    await this.rbacService.setRolePermissions(roleId, updatedList);

    return this.getFieldPermissions(roleId, entityType);
  }
}
