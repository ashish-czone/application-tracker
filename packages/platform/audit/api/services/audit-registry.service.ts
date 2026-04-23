import { Injectable } from '@nestjs/common';
import type { AuditModuleRegistration } from '../types';

@Injectable()
export class AuditRegistryService {
  private readonly registrations = new Map<string, AuditModuleRegistration>();

  register(moduleName: string, registration: AuditModuleRegistration): void {
    this.registrations.set(moduleName, registration);
  }

  findRegistration(eventName: string): { moduleName: string; registration: AuditModuleRegistration } | null {
    for (const [moduleName, registration] of this.registrations) {
      if (registration.events === '*') {
        if (eventName.toLowerCase().startsWith(moduleName.toLowerCase() + '.')) {
          return { moduleName, registration };
        }
      } else if (registration.events.includes(eventName)) {
        return { moduleName, registration };
      }
    }
    return null;
  }

  /**
   * Look up the registration responsible for an entity type. The convention is
   * moduleName === entityType (slug), so this is a direct map lookup with a
   * case-insensitive fallback.
   */
  findRegistrationByEntityType(
    entityType: string,
  ): { moduleName: string; registration: AuditModuleRegistration } | null {
    const direct = this.registrations.get(entityType);
    if (direct) return { moduleName: entityType, registration: direct };
    const lower = entityType.toLowerCase();
    for (const [moduleName, registration] of this.registrations) {
      if (moduleName.toLowerCase() === lower) {
        return { moduleName, registration };
      }
    }
    return null;
  }

  getAll(): Map<string, AuditModuleRegistration> {
    return new Map(this.registrations);
  }
}
