import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RequirePermission } from '@packages/rbac';
import { TaxonomyService } from '../services/taxonomy.service';
import { CreateTagGroupDto } from '../dto/create-tag-group.dto';
import { UpdateTagGroupDto } from '../dto/update-tag-group.dto';
import { CreateTagDto } from '../dto/create-tag.dto';
import { UpdateTagDto } from '../dto/update-tag.dto';
import { ListTagGroupsQueryDto } from '../dto/list-tag-groups-query.dto';
import { TAXONOMY_PERMISSIONS } from '../permissions';

@ApiTags('taxonomy')
@Controller()
export class TagsController {
  constructor(private readonly taxonomyService: TaxonomyService) {}

  // --- Tag Groups ---

  @Get('tag-groups')
  @RequirePermission(TAXONOMY_PERMISSIONS.TAG_GROUPS_READ)
  @ApiOperation({ summary: 'List tag groups with pagination' })
  async listTagGroups(@Query() query: ListTagGroupsQueryDto) {
    return this.taxonomyService.listTagGroups(query);
  }

  @Get('tag-groups/:id')
  @RequirePermission(TAXONOMY_PERMISSIONS.TAG_GROUPS_READ)
  @ApiOperation({ summary: 'Get a single tag group by ID' })
  async findTagGroup(@Param('id', ParseUUIDPipe) id: string) {
    return this.taxonomyService.findTagGroupByIdOrFail(id);
  }

  @Post('tag-groups')
  @RequirePermission(TAXONOMY_PERMISSIONS.TAG_GROUPS_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new tag group' })
  async createTagGroup(@Body() dto: CreateTagGroupDto) {
    return this.taxonomyService.createTagGroup(dto);
  }

  @Patch('tag-groups/:id')
  @RequirePermission(TAXONOMY_PERMISSIONS.TAG_GROUPS_MANAGE)
  @ApiOperation({ summary: 'Update a tag group' })
  async updateTagGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTagGroupDto,
  ) {
    return this.taxonomyService.updateTagGroup(id, dto);
  }

  @Delete('tag-groups/:id')
  @RequirePermission(TAXONOMY_PERMISSIONS.TAG_GROUPS_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a tag group (must have no attached tags)' })
  async deleteTagGroup(@Param('id', ParseUUIDPipe) id: string) {
    await this.taxonomyService.deleteTagGroup(id);
  }

  // --- Tags (nested under groups) ---

  @Get('tag-groups/:groupId/tags')
  @RequirePermission(TAXONOMY_PERMISSIONS.TAGS_READ)
  @ApiOperation({ summary: 'List all tags in a group' })
  async listTags(@Param('groupId', ParseUUIDPipe) groupId: string) {
    return this.taxonomyService.listTagsByGroup(groupId);
  }

  @Get('tags/group/:slug')
  @RequirePermission(TAXONOMY_PERMISSIONS.TAGS_READ)
  @ApiOperation({ summary: 'List tags by group slug as select options' })
  async getTagsByGroupSlug(@Param('slug') slug: string) {
    return this.taxonomyService.listTagOptionsByGroupSlug(slug);
  }

  @Get('tags/:id')
  @RequirePermission(TAXONOMY_PERMISSIONS.TAGS_READ)
  @ApiOperation({ summary: 'Get a single tag by ID' })
  async findTag(@Param('id', ParseUUIDPipe) id: string) {
    return this.taxonomyService.findTagByIdOrFail(id);
  }

  @Post('tag-groups/:groupId/tags')
  @RequirePermission(TAXONOMY_PERMISSIONS.TAGS_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new tag in a group' })
  async createTag(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: CreateTagDto,
  ) {
    return this.taxonomyService.createTag({ ...dto, tagGroupId: groupId });
  }

  @Patch('tags/:id')
  @RequirePermission(TAXONOMY_PERMISSIONS.TAGS_MANAGE)
  @ApiOperation({ summary: 'Update a tag' })
  async updateTag(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTagDto,
  ) {
    return this.taxonomyService.updateTag(id, dto);
  }

  @Delete('tags/:id')
  @RequirePermission(TAXONOMY_PERMISSIONS.TAGS_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a tag (must not be attached to entities)' })
  async deleteTag(@Param('id', ParseUUIDPipe) id: string) {
    await this.taxonomyService.deleteTag(id);
  }
}
