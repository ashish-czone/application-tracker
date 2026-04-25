import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@packages/auth-core';
import { MenusPublicService, type PublicMenuResponse } from '../services/menus-public.service';

@ApiTags('menus')
@Controller()
export class MenusPublicController {
  constructor(private readonly service: MenusPublicService) {}

  @Public()
  @Get('public/menus/:slug')
  @ApiOperation({ summary: 'Fetch a menu by slug with its items as a nested tree (unauthenticated)' })
  getBySlug(@Param('slug') slug: string): Promise<PublicMenuResponse> {
    return this.service.getBySlug(slug);
  }
}
