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
import { CategoryService } from '../services/category.service';
import { CreateCategoryGroupDto } from '../dto/create-category-group.dto';
import { UpdateCategoryGroupDto } from '../dto/update-category-group.dto';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { MoveCategoryDto } from '../dto/move-category.dto';
import { TAXONOMY_PERMISSIONS } from '../permissions';

@ApiTags('taxonomy')
@Controller()
export class CategoriesController {
  constructor(private readonly categoryService: CategoryService) {}

  // --- Category Groups ---

  @Get('category-groups')
  @RequirePermission(TAXONOMY_PERMISSIONS.CATEGORIES_READ)
  @ApiOperation({ summary: 'List all category groups' })
  async listCategoryGroups() {
    return this.categoryService.listCategoryGroups();
  }

  @Get('category-groups/:id')
  @RequirePermission(TAXONOMY_PERMISSIONS.CATEGORIES_READ)
  @ApiOperation({ summary: 'Get a single category group by ID' })
  async findCategoryGroup(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoryService.findCategoryGroupByIdOrFail(id);
  }

  @Post('category-groups')
  @RequirePermission(TAXONOMY_PERMISSIONS.CATEGORIES_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new category group' })
  async createCategoryGroup(@Body() dto: CreateCategoryGroupDto) {
    return this.categoryService.createCategoryGroup(dto);
  }

  @Patch('category-groups/:id')
  @RequirePermission(TAXONOMY_PERMISSIONS.CATEGORIES_MANAGE)
  @ApiOperation({ summary: 'Update a category group' })
  async updateCategoryGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryGroupDto,
  ) {
    return this.categoryService.updateCategoryGroup(id, dto);
  }

  @Delete('category-groups/:id')
  @RequirePermission(TAXONOMY_PERMISSIONS.CATEGORIES_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a category group (must have no categories)' })
  async deleteCategoryGroup(@Param('id', ParseUUIDPipe) id: string) {
    await this.categoryService.deleteCategoryGroup(id);
  }

  // --- Category lookup by group slug (for filter dropdowns) ---

  @Get('categories/group/:slug')
  @RequirePermission(TAXONOMY_PERMISSIONS.CATEGORIES_READ)
  @ApiOperation({ summary: 'List categories by group slug as select options' })
  async getCategoriesByGroupSlug(
    @Param('slug') slug: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ) {
    return this.categoryService.listCategoryOptionsByGroupSlug(
      slug,
      search || undefined,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  // --- Categories ---

  @Get('category-groups/:groupId/tree')
  @RequirePermission(TAXONOMY_PERMISSIONS.CATEGORIES_READ)
  @ApiOperation({ summary: 'Get the full category tree for a group' })
  async getTree(@Param('groupId', ParseUUIDPipe) groupId: string) {
    return this.categoryService.getTree(groupId);
  }

  @Get('categories/:id')
  @RequirePermission(TAXONOMY_PERMISSIONS.CATEGORIES_READ)
  @ApiOperation({ summary: 'Get a single category by ID' })
  async findCategory(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoryService.findCategoryByIdOrFail(id);
  }

  @Get('categories/:id/ancestors')
  @RequirePermission(TAXONOMY_PERMISSIONS.CATEGORIES_READ)
  @ApiOperation({ summary: 'Get ancestors of a category (breadcrumb path)' })
  async getAncestors(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoryService.getAncestors(id);
  }

  @Post('category-groups/:groupId/categories')
  @RequirePermission(TAXONOMY_PERMISSIONS.CATEGORIES_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new category in a group' })
  async createCategory(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.categoryService.createCategory({ ...dto, groupId });
  }

  @Patch('categories/:id')
  @RequirePermission(TAXONOMY_PERMISSIONS.CATEGORIES_MANAGE)
  @ApiOperation({ summary: 'Update a category' })
  async updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoryService.updateCategory(id, dto);
  }

  @Patch('categories/:id/move')
  @RequirePermission(TAXONOMY_PERMISSIONS.CATEGORIES_MANAGE)
  @ApiOperation({ summary: 'Move a category to a new parent' })
  async moveCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoveCategoryDto,
  ) {
    return this.categoryService.moveCategory(id, dto.parentId ?? null);
  }

  @Delete('categories/:id')
  @RequirePermission(TAXONOMY_PERMISSIONS.CATEGORIES_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a category (must have no children)' })
  async deleteCategory(@Param('id', ParseUUIDPipe) id: string) {
    await this.categoryService.deleteCategory(id);
  }
}
