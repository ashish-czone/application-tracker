import { Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { TESTIMONIALS_CONFIG } from './testimonials.config';
import { FAQ_ITEMS_CONFIG } from './faq-items.config';
import { TEAM_MEMBERS_CONFIG } from './team-members.config';
import { SERVICES_CONFIG } from './services.config';
import { CLIENT_LOGOS_CONFIG } from './client-logos.config';
import { VALUE_PROPS_CONFIG } from './value-props.config';
import { STATS_CONFIG } from './stats.config';
import { TestimonialsController } from './controllers/testimonials.controller';
import { FaqItemsController } from './controllers/faq-items.controller';
import { TeamMembersController } from './controllers/team-members.controller';
import { ServicesController } from './controllers/services.controller';
import { ClientLogosController } from './controllers/client-logos.controller';
import { ValuePropsController } from './controllers/value-props.controller';
import { StatsController } from './controllers/stats.controller';
import { TestimonialsService } from './services/testimonials.service';
import { FaqItemsService } from './services/faq-items.service';
import { TeamMembersService } from './services/team-members.service';
import { ServicesService } from './services/services.service';
import { ClientLogosService } from './services/client-logos.service';
import { ValuePropsService } from './services/value-props.service';
import { StatsService } from './services/stats.service';

/**
 * ContentModule registers seven content primitives (testimonials, FAQ items,
 * team members, services, client logos, value propositions, stats) with the
 * entity-engine. Each entity has its own hand-written CRUD controller, thin
 * service delegate to `ENTITY_SERVICE_*`, and drizzle-zod DTOs. forEntity
 * registrations skip the auto-mounted controller so each entity's HTTP
 * surface is explicit and customizable.
 *
 * Primitives back the datasource-bound page blocks (Testimonials, FAQ, Team,
 * Services, Logo Cloud, Why Choose Us, Stats) so marketers manage content in
 * the admin and blocks render whatever the datasource returns.
 */
@Module({
  imports: [
    EntityEngineModule.forEntity(TESTIMONIALS_CONFIG, { controller: 'none' }),
    EntityEngineModule.forEntity(FAQ_ITEMS_CONFIG, { controller: 'none' }),
    EntityEngineModule.forEntity(TEAM_MEMBERS_CONFIG, { controller: 'none' }),
    EntityEngineModule.forEntity(SERVICES_CONFIG, { controller: 'none' }),
    EntityEngineModule.forEntity(CLIENT_LOGOS_CONFIG, { controller: 'none' }),
    EntityEngineModule.forEntity(VALUE_PROPS_CONFIG, { controller: 'none' }),
    EntityEngineModule.forEntity(STATS_CONFIG, { controller: 'none' }),
  ],
  controllers: [
    TestimonialsController,
    FaqItemsController,
    TeamMembersController,
    ServicesController,
    ClientLogosController,
    ValuePropsController,
    StatsController,
  ],
  providers: [
    TestimonialsService,
    FaqItemsService,
    TeamMembersService,
    ServicesService,
    ClientLogosService,
    ValuePropsService,
    StatsService,
  ],
  exports: [
    TestimonialsService,
    FaqItemsService,
    TeamMembersService,
    ServicesService,
    ClientLogosService,
    ValuePropsService,
    StatsService,
  ],
})
export class ContentModule {}
