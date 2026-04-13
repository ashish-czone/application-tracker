import { Module } from '@nestjs/common';
import { ClientsSeedService } from './clients-seed.service';

/**
 * Clients domain module.
 * CRUD/routing/RBAC/events handled by EntityEngineModule.forEntity(clientsConfig).
 * This module provides sample data seeding for Clients, Contacts, Vendors, and Interviews.
 */
@Module({
  providers: [ClientsSeedService],
})
export class ClientsModule {}
