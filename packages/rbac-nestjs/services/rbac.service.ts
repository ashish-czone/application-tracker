import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import type { RbacModuleConfig } from '@packages/rbac';
import { RBAC_MODULE_CONFIG } from '../constants';

@Injectable()
export class RbacService {
  constructor(
    @Inject(RBAC_MODULE_CONFIG)
    private readonly config: RbacModuleConfig,
  ) {}

  // --- Role CRUD ---

  async createRole(name: string, description?: string) {
    const roleDelegate = this.config.getRoleDelegate();
    const existing = await roleDelegate.findUnique({ where: { name } });
    if (existing) {
      throw new ConflictException(`Role "${name}" already exists`);
    }
    return roleDelegate.create({ data: { name, description } });
  }

  async findAllRoles() {
    const roleDelegate = this.config.getRoleDelegate();
    return roleDelegate.findMany({ orderBy: { name: 'asc' } });
  }

  async findRoleById(id: string) {
    const roleDelegate = this.config.getRoleDelegate();
    const role = await roleDelegate.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }

  async updateRole(id: string, data: { name?: string; description?: string }) {
    await this.findRoleById(id);

    if (data.name) {
      const roleDelegate = this.config.getRoleDelegate();
      const existing = await roleDelegate.findUnique({ where: { name: data.name } });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Role "${data.name}" already exists`);
      }
    }

    const roleDelegate = this.config.getRoleDelegate();
    return roleDelegate.update({ where: { id }, data });
  }

  async deleteRole(id: string) {
    await this.findRoleById(id);
    const roleDelegate = this.config.getRoleDelegate();
    return roleDelegate.delete({ where: { id } });
  }

  // --- Permission sync ---

  async syncPermissions(resource: string, permissions: { action: string; description?: string }[]) {
    const permissionDelegate = this.config.getPermissionDelegate();
    const results = [];

    for (const perm of permissions) {
      const result = await permissionDelegate.upsert({
        where: { resource_action: { resource, action: perm.action } },
        create: { resource, action: perm.action, description: perm.description },
        update: { description: perm.description },
      });
      results.push(result);
    }

    return results;
  }

  async findAllPermissions() {
    const permissionDelegate = this.config.getPermissionDelegate();
    return permissionDelegate.findMany({ orderBy: { resource: 'asc' } });
  }

  // --- Role-Permission management ---

  async setRolePermissions(roleId: string, permissionIds: string[]) {
    await this.findRoleById(roleId);
    const rpDelegate = this.config.getRolePermissionDelegate();

    // Remove existing
    await rpDelegate.deleteMany({ where: { roleId } });

    // Add new
    if (permissionIds.length > 0) {
      await rpDelegate.createMany({
        data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
        skipDuplicates: true,
      });
    }
  }

  async getRolePermissions(roleId: string) {
    await this.findRoleById(roleId);
    const rpDelegate = this.config.getRolePermissionDelegate();
    return rpDelegate.findMany({
      where: { roleId },
      include: { permission: true },
    });
  }

  // --- User-Role management ---

  async assignRoleToUser(userId: string, roleId: string) {
    await this.findRoleById(roleId);
    const urDelegate = this.config.getUserRoleDelegate();
    return urDelegate.create({ data: { userId, roleId } });
  }

  async removeRoleFromUser(userId: string, roleId: string) {
    const urDelegate = this.config.getUserRoleDelegate();
    return urDelegate.delete({
      where: { userId_roleId: { userId, roleId } },
    });
  }

  async getUserRoles(userId: string) {
    const urDelegate = this.config.getUserRoleDelegate();
    return urDelegate.findMany({
      where: { userId },
      include: { role: true },
    });
  }

  // --- Permission check (used by guard) ---

  async getUserPermissions(userId: string): Promise<string[]> {
    const urDelegate = this.config.getUserRoleDelegate();
    const userRoles = await urDelegate.findMany({ where: { userId } });

    if (userRoles.length === 0) return [];

    const roleIds = userRoles.map((ur) => ur.roleId);
    const rpDelegate = this.config.getRolePermissionDelegate();

    const allPermissions: string[] = [];
    for (const roleId of roleIds) {
      const rps = await rpDelegate.findMany({
        where: { roleId },
        include: { permission: true },
      });
      for (const rp of rps) {
        const perm = (rp as Record<string, unknown>).permission as { resource: string; action: string } | undefined;
        if (perm) {
          const key = `${perm.resource}.${perm.action}`;
          if (!allPermissions.includes(key)) {
            allPermissions.push(key);
          }
        }
      }
    }

    return allPermissions;
  }

  // --- Superadmin bootstrap ---

  async bootstrapSuperadmin(userId: string) {
    const roleDelegate = this.config.getRoleDelegate();

    // Find or create superadmin role
    let superadminRole = await roleDelegate.findUnique({ where: { name: 'superadmin' } });
    if (!superadminRole) {
      try {
        superadminRole = await roleDelegate.create({
          data: { name: 'superadmin', description: 'Full system access' },
        });
      } catch {
        // Race condition: another request created it first
        superadminRole = await roleDelegate.findUnique({ where: { name: 'superadmin' } });
        if (!superadminRole) throw new Error('Failed to create or find superadmin role');
      }
    }

    if (!superadminRole) {
      throw new Error('Failed to create or find superadmin role');
    }

    // Check if any user already has superadmin role
    const urDelegate = this.config.getUserRoleDelegate();
    const existingSuperadmins = await urDelegate.findMany({
      where: { roleId: superadminRole.id },
    });

    if (existingSuperadmins.length === 0) {
      try {
        await urDelegate.create({
          data: { userId, roleId: superadminRole.id },
        });
      } catch {
        // Race condition: another request assigned it first — safe to ignore
      }
    }
  }
}
