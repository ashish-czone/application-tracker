import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService, eq, asc, count, ilike } from '@packages/database';
import { HierarchyService, buildTree } from '@packages/hierarchy';
import { withTenant, withTenantInsert } from '@packages/tenancy/helpers';
import { categoryGroups } from '../schema/category-groups';
import { categories } from '../schema/categories';
import type { CategoryGroup, Category, CategoryTreeNode } from '../types';

@Injectable()
export class CategoryService {
  constructor(
    private readonly database: DatabaseService,
    private readonly hierarchyService: HierarchyService,
  ) {}

  // --- Category Groups ---

  async createCategoryGroup(data: { name: string; slug: string; description?: string; sortOrder?: number }): Promise<CategoryGroup> {
    const [group] = await this.database.db
      .insert(categoryGroups)
      .values(withTenantInsert(categoryGroups, {
        name: data.name,
        slug: data.slug,
        description: data.description ?? null,
        sortOrder: data.sortOrder ?? 0,
      }))
      .returning();
    return group;
  }

  async updateCategoryGroup(id: string, data: { name?: string; slug?: string; description?: string; sortOrder?: number }): Promise<CategoryGroup> {
    const updateValues: Record<string, unknown> = {};
    if (data.name !== undefined) updateValues.name = data.name;
    if (data.slug !== undefined) updateValues.slug = data.slug;
    if (data.description !== undefined) updateValues.description = data.description;
    if (data.sortOrder !== undefined) updateValues.sortOrder = data.sortOrder;

    if (Object.keys(updateValues).length === 0) {
      return this.findCategoryGroupByIdOrFail(id);
    }

    const [group] = await this.database.db
      .update(categoryGroups)
      .set(updateValues)
      .where(withTenant(categoryGroups, eq(categoryGroups.id, id)))
      .returning();

    if (!group) throw new NotFoundException('Category group not found');
    return group;
  }

  async deleteCategoryGroup(id: string): Promise<void> {
    const group = await this.findCategoryGroupById(id);
    if (!group) throw new NotFoundException('Category group not found');

    const [{ total }] = await this.database.db
      .select({ total: count() })
      .from(categories)
      .where(withTenant(categories, eq(categories.groupId, id)));

    if (Number(total) > 0) {
      throw new ConflictException('Cannot delete a category group that has categories. Remove all categories first.');
    }

    await this.database.db.delete(categoryGroups).where(withTenant(categoryGroups, eq(categoryGroups.id, id)));
  }

  async findCategoryGroupById(id: string): Promise<CategoryGroup | null> {
    const [group] = await this.database.db
      .select()
      .from(categoryGroups)
      .where(withTenant(categoryGroups, eq(categoryGroups.id, id)))
      .limit(1);
    return group ?? null;
  }

  async findCategoryGroupByIdOrFail(id: string): Promise<CategoryGroup> {
    const group = await this.findCategoryGroupById(id);
    if (!group) throw new NotFoundException('Category group not found');
    return group;
  }

  async listCategoryGroups(): Promise<CategoryGroup[]> {
    return this.database.db
      .select()
      .from(categoryGroups)
      .where(withTenant(categoryGroups))
      .orderBy(asc(categoryGroups.sortOrder), asc(categoryGroups.name));
  }

  // --- Categories ---

  async createCategory(data: { groupId: string; parentId?: string; name: string; slug: string; sortOrder?: number }): Promise<Category> {
    await this.findCategoryGroupByIdOrFail(data.groupId);

    let parentPath: string | null = null;

    if (data.parentId) {
      const parent = await this.findCategoryByIdOrFail(data.parentId);
      if (parent.groupId !== data.groupId) {
        throw new ConflictException('Parent category must belong to the same group');
      }
      parentPath = parent.path;
    }

    // Insert with a temporary path, then update with the real path using the generated ID
    const [category] = await this.database.db
      .insert(categories)
      .values(withTenantInsert(categories, {
        groupId: data.groupId,
        parentId: data.parentId ?? null,
        name: data.name,
        slug: data.slug,
        sortOrder: data.sortOrder ?? 0,
        path: '/',
        depth: 0,
      }))
      .returning();

    const { path, depth } = this.hierarchyService.computeInsertValues(parentPath, category.id);

    const [updated] = await this.database.db
      .update(categories)
      .set({ path, depth })
      .where(withTenant(categories, eq(categories.id, category.id)))
      .returning();

    return updated;
  }

  async updateCategory(id: string, data: { name?: string; slug?: string; sortOrder?: number }): Promise<Category> {
    const updateValues: Record<string, unknown> = {};
    if (data.name !== undefined) updateValues.name = data.name;
    if (data.slug !== undefined) updateValues.slug = data.slug;
    if (data.sortOrder !== undefined) updateValues.sortOrder = data.sortOrder;

    if (Object.keys(updateValues).length === 0) {
      return this.findCategoryByIdOrFail(id);
    }

    const [category] = await this.database.db
      .update(categories)
      .set(updateValues)
      .where(withTenant(categories, eq(categories.id, id)))
      .returning();

    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async moveCategory(id: string, newParentId: string | null): Promise<Category> {
    const category = await this.findCategoryByIdOrFail(id);

    let newParentPath: string | null = null;

    if (newParentId) {
      const newParent = await this.findCategoryByIdOrFail(newParentId);

      if (newParent.groupId !== category.groupId) {
        throw new ConflictException('Cannot move category to a different group');
      }

      newParentPath = newParent.path;
    }

    // HierarchyService handles cycle detection + path updates for entire subtree
    await this.hierarchyService.move(
      categories, categories.id, categories.parentId, categories.path, categories.depth,
      id, category.path, newParentId, newParentPath,
    );

    return this.findCategoryByIdOrFail(id);
  }

  async deleteCategory(id: string): Promise<void> {
    const category = await this.findCategoryById(id);
    if (!category) throw new NotFoundException('Category not found');

    // Check for children
    const [{ total }] = await this.database.db
      .select({ total: count() })
      .from(categories)
      .where(withTenant(categories, eq(categories.parentId, id)));

    if (Number(total) > 0) {
      throw new ConflictException('Cannot delete a category that has children. Remove or move child categories first.');
    }

    await this.database.db.delete(categories).where(withTenant(categories, eq(categories.id, id)));
  }

  async findCategoryById(id: string): Promise<Category | null> {
    const [category] = await this.database.db
      .select()
      .from(categories)
      .where(withTenant(categories, eq(categories.id, id)))
      .limit(1);
    return category ?? null;
  }

  async findCategoryByIdOrFail(id: string): Promise<Category> {
    const category = await this.findCategoryById(id);
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  // --- Tree Operations ---

  async getTree(groupId: string): Promise<CategoryTreeNode[]> {
    await this.findCategoryGroupByIdOrFail(groupId);

    const allCategories = await this.database.db
      .select()
      .from(categories)
      .where(withTenant(categories, eq(categories.groupId, groupId)))
      .orderBy(asc(categories.sortOrder), asc(categories.name));

    return buildTree(allCategories) as CategoryTreeNode[];
  }

  async getAncestors(id: string): Promise<Category[]> {
    const category = await this.findCategoryByIdOrFail(id);
    return this.hierarchyService.getAncestors(categories, categories.id, categories.path, category.path);
  }

  async getDescendants(id: string): Promise<Category[]> {
    const category = await this.findCategoryByIdOrFail(id);
    return this.hierarchyService.getDescendants(categories, categories.path, category.path);
  }

  // --- Lookup (for filter dropdowns) ---

  async listCategoryOptionsByGroupSlug(
    slug: string,
    search?: string,
    limit?: number,
  ): Promise<{ value: string; label: string }[]> {
    const [group] = await this.database.db
      .select({ id: categoryGroups.id })
      .from(categoryGroups)
      .where(withTenant(categoryGroups, eq(categoryGroups.slug, slug)))
      .limit(1);

    if (!group) return [];

    const conditions = [eq(categories.groupId, group.id)];
    if (search) {
      conditions.push(ilike(categories.name, `%${search}%`));
    }

    const rows = await this.database.db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(withTenant(categories, ...conditions))
      .orderBy(asc(categories.name))
      .limit(limit ?? 50);

    return rows.map((r) => ({ value: r.id, label: r.name }));
  }

  // --- Validation (for domain modules) ---

  async validateCategoryInGroup(categoryId: string, groupSlug: string): Promise<Category> {
    const category = await this.findCategoryByIdOrFail(categoryId);

    const [group] = await this.database.db
      .select()
      .from(categoryGroups)
      .where(withTenant(categoryGroups, eq(categoryGroups.id, category.groupId)))
      .limit(1);

    if (!group || group.slug !== groupSlug) {
      throw new ConflictException(`Category does not belong to group "${groupSlug}"`);
    }

    return category;
  }

}
