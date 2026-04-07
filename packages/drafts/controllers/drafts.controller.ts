import { Controller, Get, Post, Delete, Body, Query, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser, type JwtPayload } from '@packages/auth-core';
import { DraftsService } from '../services/drafts.service';
import { SaveDraftDto } from '../dto/save-draft.dto';
import { ListDraftsQueryDto } from '../dto/list-drafts-query.dto';

@ApiTags('drafts')
@Controller('drafts')
export class DraftsController {
  constructor(private readonly draftsService: DraftsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save (upsert) a draft' })
  save(@CurrentUser() user: JwtPayload, @Body() dto: SaveDraftDto) {
    return this.draftsService.save({
      entityType: dto.entityType,
      draftKey: dto.draftKey,
      data: dto.data,
      createdById: user.userId,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List drafts for current user' })
  list(@CurrentUser() user: JwtPayload, @Query() query: ListDraftsQueryDto) {
    return this.draftsService.listForUser(user.userId, query.entityType);
  }

  @Get(':entityType/:draftKey')
  @ApiOperation({ summary: 'Get a specific draft' })
  async find(
    @CurrentUser() user: JwtPayload,
    @Param('entityType') entityType: string,
    @Param('draftKey') draftKey: string,
  ) {
    return this.draftsService.find(entityType, draftKey, user.userId);
  }

  @Delete(':entityType/:draftKey')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a draft' })
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param('entityType') entityType: string,
    @Param('draftKey') draftKey: string,
  ) {
    await this.draftsService.delete(entityType, draftKey, user.userId);
  }
}
