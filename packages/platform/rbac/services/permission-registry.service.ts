import { Injectable } from '@nestjs/common';
import type { PermissionRegistryEntry } from '../types';

@Injectable()
export class PermissionRegistryService {
  private readonly registry: Map<string, PermissionRegistryEntry[]> = new Map();

  register(module: string, permissions: { action: string; description: string }[]) {
    const entries = permissions.map((p) => ({
      module,
      action: p.action,
      description: p.description,
    }));
    this.registry.set(module, entries);
  }

  getAll(): PermissionRegistryEntry[] {
    return Array.from(this.registry.values()).flat();
  }

  getByModule(module: string): PermissionRegistryEntry[] {
    return this.registry.get(module) ?? [];
  }

  has(module: string): boolean {
    return this.registry.has(module);
  }
}
