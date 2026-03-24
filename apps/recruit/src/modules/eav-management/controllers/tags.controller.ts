import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RequirePermission } from '@packages/rbac';
import { TaxonomyService } from '@packages/taxonomy';
import { EAV_PERMISSIONS } from '../permissions';

@ApiTags('tags')
@Controller('tags')
export class TagsController {
  constructor(private readonly taxonomyService: TaxonomyService) {}

  @Get('group/:slug')
  @RequirePermission(EAV_PERMISSIONS.READ)
  @ApiOperation({ summary: 'List tags by group slug (for chip input options)' })
  async getTagsByGroupSlug(@Param('slug') slug: string) {
    const tags = await this.taxonomyService.listTagsByGroupSlug(slug);
    return tags.map(t => ({
      value: t.id,
      label: t.name,
      color: t.color,
    }));
  }
}
