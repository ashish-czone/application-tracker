import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RequirePermission } from '@packages/rbac';
import { LookupResolverService } from '@packages/eav-attributes';
import { EAV_PERMISSIONS } from '../permissions';

@ApiTags('lookups')
@Controller('lookups')
export class LookupsController {
  constructor(private readonly lookupResolverService: LookupResolverService) {}

  @Get()
  @RequirePermission(EAV_PERMISSIONS.READ)
  @ApiOperation({ summary: 'List registered lookup entities' })
  getRegisteredEntities() {
    return this.lookupResolverService.getRegisteredEntities();
  }

  @Get(':entity')
  @RequirePermission(EAV_PERMISSIONS.READ)
  @ApiOperation({ summary: 'Search lookup values for an entity' })
  async search(
    @Param('entity') entity: string,
    @Query('search') search: string = '',
    @Query('limit') limit: string = '20',
  ) {
    return this.lookupResolverService.search(entity, search, parseInt(limit, 10));
  }
}
