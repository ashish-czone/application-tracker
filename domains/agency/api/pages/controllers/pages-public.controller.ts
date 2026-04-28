import { Body, Controller, Get, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@packages/auth-core';
import { RequirePermission } from '@packages/rbac';
import {
  PagesPublicService,
  type PublicPageResponse,
  type PublicPagesIndexResponse,
} from '../services/pages-public.service';
import { ReorderSectionsDto } from '../dto/reorder-sections.dto';

@ApiTags('pages')
@Controller()
export class PagesPublicController {
  constructor(private readonly service: PagesPublicService) {}

  @Public()
  @Get('public/pages')
  @ApiOperation({ summary: 'List published pages (slug + timestamps, unauthenticated)' })
  list(): Promise<PublicPagesIndexResponse> {
    return this.service.listPublished();
  }

  @Public()
  @Get('public/pages/:slug')
  @ApiOperation({ summary: 'Fetch a published landing page by slug (unauthenticated)' })
  getBySlug(@Param('slug') slug: string): Promise<PublicPageResponse> {
    return this.service.getBySlug(slug);
  }

  /**
   * Two-segment slugs (e.g. `services/implementation`). Stored in the
   * pages table as a single slug `parent/child`; this route stitches
   * the URL segments back into that shape so the customer site can
   * use natural URLs like `/services/implementation`. Limited to two
   * levels by design — deeper hierarchies are an entity-engine job.
   */
  @Public()
  @Get('public/pages/:parentSlug/:childSlug')
  @ApiOperation({ summary: 'Fetch a published nested landing page (unauthenticated)' })
  getByNestedSlug(
    @Param('parentSlug') parent: string,
    @Param('childSlug') child: string,
  ): Promise<PublicPageResponse> {
    return this.service.getBySlug(`${parent}/${child}`);
  }

  @Put('pages/:pageId/sections\\:reorder')
  @RequirePermission('pages.update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Bulk reorder sections within a page' })
  async reorder(
    @Param('pageId') pageId: string,
    @Body() dto: ReorderSectionsDto,
  ): Promise<void> {
    await this.service.reorder(pageId, dto.orders);
  }
}
