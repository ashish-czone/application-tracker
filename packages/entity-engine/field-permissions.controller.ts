import { Controller, Get, Put, Param, Body, ParseUUIDPipe, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RequirePermission, RbacService } from '@packages/rbac';
import { FieldDefinitionService } from '@packages/eav-attributes';
import { EntityRegistryService } from './entity-registry.service';

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
    private readonly registry: EntityRegistryService,
    private readonly rbacService: RbacService,
    private readonly fieldDefinitionService: FieldDefinitionService,
  ) {}

  @Get('roles/:roleId/entities/:entityType')
  @RequirePermission('rbac.roles-read')
  @ApiOperation({ summary: 'Get field permissions for a role + entity' })
  async getFieldPermissions(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Param('entityType') entityType: string,
  ): Promise<FieldPermissionEntry[]> {
    const config = this.registry.get(entityType);
    if (!config) throw new NotFoundException(`Entity type '${entityType}' not found`);

    await this.rbacService.findRoleByIdOrFail(roleId);
    const rolePerms = await this.rbacService.getRolePermissions(roleId);
    const permSet = new Set(Object.keys(rolePerms));

    const fields = await this.fieldDefinitionService.listByEntity(entityType);

    return fields.map((field) => {
      const meta = config.fieldMeta[field.fieldKey];
      const isSystem = meta?.isSystem ?? field.isSystem;
      const isRequired = field.isRequired;

      let access: FieldAccess = 'read_write';
      if (!isSystem) {
        if (permSet.has(`${config.slug}.hide-${field.fieldKey}`)) {
          access = 'hidden';
        } else if (permSet.has(`${config.slug}.readonly-${field.fieldKey}`)) {
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
    const config = this.registry.get(entityType);
    if (!config) throw new NotFoundException(`Entity type '${entityType}' not found`);

    await this.rbacService.findRoleByIdOrFail(roleId);

    // Get existing role permissions as Record<permission, scope>
    const existingPerms = await this.rbacService.getRolePermissions(roleId);

    // Rebuild: keep all non-field-restriction permissions, replace field restrictions for this entity
    const hidePrefix = `${config.slug}.hide-`;
    const readonlyPrefix = `${config.slug}.readonly-`;

    const updatedList: { name: string; scope: string }[] = [];

    // Keep existing permissions that aren't field restrictions for this entity
    for (const [perm, scope] of Object.entries(existingPerms)) {
      if (!perm.startsWith(hidePrefix) && !perm.startsWith(readonlyPrefix)) {
        updatedList.push({ name: perm, scope });
      }
    }

    // Add new restriction entries from the matrix
    for (const { fieldKey, access } of body.fields) {
      const meta = config.fieldMeta[fieldKey];
      if (meta?.isSystem) continue;

      if (access === 'hidden') {
        updatedList.push({ name: `${config.slug}.hide-${fieldKey}`, scope: 'all' });
      } else if (access === 'read_only') {
        updatedList.push({ name: `${config.slug}.readonly-${fieldKey}`, scope: 'all' });
      }
    }

    await this.rbacService.setRolePermissions(roleId, updatedList);

    // Return updated state
    return this.getFieldPermissions(roleId, entityType);
  }
}
