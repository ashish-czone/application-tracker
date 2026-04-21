import { Module } from '@nestjs/common';

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
  imports: [],
})
export class ContentModule {}
