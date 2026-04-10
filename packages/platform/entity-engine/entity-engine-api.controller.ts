import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '@packages/auth';
import { EntityRegistryService } from './entity-registry.service';
import type { EntityRegistryEntry } from './types';

/**
 * Exposes the entity registry to the frontend.
 * The frontend uses this to auto-generate routes, navigation, and API clients.
 */
@ApiTags('entity-engine')
@Controller('entity-engine')
export class EntityEngineApiController {
  constructor(private readonly registry: EntityRegistryService) {}

  @Get('registry')
  @Public()
  @ApiOperation({ summary: 'Get all registered entity types (for frontend auto-rendering)' })
  getRegistry(): EntityRegistryEntry[] {
    return this.registry.getRegistryEntries();
  }
}
