import { Injectable } from '@nestjs/common';

export interface RegisteredPermission {
  action: string;
  description?: string;
}

export interface RegisteredResource {
  resource: string;
  permissions: RegisteredPermission[];
}

@Injectable()
export class PermissionRegistryService {
  private registry = new Map<string, RegisteredPermission[]>();

  register(resource: string, permissions: RegisteredPermission[]) {
    this.registry.set(resource, permissions);
  }

  getAll(): RegisteredResource[] {
    const result: RegisteredResource[] = [];
    for (const [resource, permissions] of this.registry) {
      result.push({ resource, permissions });
    }
    return result.sort((a, b) => a.resource.localeCompare(b.resource));
  }

  getByResource(resource: string): RegisteredPermission[] | undefined {
    return this.registry.get(resource);
  }
}
