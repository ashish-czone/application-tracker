import { Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { TESTIMONIALS_CONFIG } from './testimonials.config';
import { FAQ_ITEMS_CONFIG } from './faq-items.config';
import { TEAM_MEMBERS_CONFIG } from './team-members.config';
import { SERVICES_CONFIG } from './services.config';

/**
 * ContentModule registers content primitives (testimonials, FAQ items, team
 * members, services, client logos, value propositions, stats) with the
 * entity-engine. Each is a straight `defineEntity()` with its own table and
 * auto-generated CRUD/RBAC/audit. The primitives back the datasource-bound
 * page blocks (Testimonials, FAQ, Team, Services, Logo Cloud, Why Choose Us,
 * Stats) so marketers manage content in the admin and blocks render whatever
 * the datasource returns.
 */
@Module({
  imports: [
    EntityEngineModule.forEntity(TESTIMONIALS_CONFIG),
    EntityEngineModule.forEntity(FAQ_ITEMS_CONFIG),
    EntityEngineModule.forEntity(TEAM_MEMBERS_CONFIG),
    EntityEngineModule.forEntity(SERVICES_CONFIG),
  ],
})
export class ContentModule {}
