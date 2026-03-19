import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService, eq, and, isNull, asc, count } from '@packages/database';
import { categoryGroups } from '../schema/category-groups';
import { categories } from '../schema/categories';
import type { CategoryGroup, Category, CategoryTreeNode } from '../types';

@Injectable()
export class CategoryService {
  constructor(private readonly database: DatabaseService) {}

  // --- Category Groups ---

  async createCategoryGroup(data: { name: string; slug: string; description?: string; sortOrder?: number }): Promise<CategoryGroup> {
    const [group] = await this.database.db
      .insert(categoryGroups)
      .values({
        name: data.name,
        slug: data.slug,
        description: data.description ?? null,
        sortOrder: data.sortOrder ?? 0,
      })
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
      .where(eq(categoryGroups.id, id))
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
      .where(eq(categories.groupId, id));

    if (Number(total) > 0) {
      throw new ConflictException('Cannot delete a category group that has categories. Remove all categories first.');
    }

    await this.database.db.delete(categoryGroups).where(eq(categoryGroups.id, id));
  }

  async findCategoryGroupById(id: string): Promise<CategoryGroup | null> {
    const [group] = await this.database.db
      .select()
      .from(categoryGroups)
      .where(eq(categoryGroups.id, id))
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
      .orderBy(asc(categoryGroups.sortOrder), asc(categoryGroups.name));
  }

  // --- Categories ---

  async createCategory(data: { groupId: string; parentId?: string; name: string; slug: string; sortOrder?: number }): Promise<Category> {
    await this.findCategoryGroupByIdOrFail(data.groupId);

    if (data.parentId) {
      const parent = await this.findCategoryByIdOrFail(data.parentId);
      if (parent.groupId !== data.groupId) {
        throw new ConflictException('Parent category must belong to the same group');
      }
    }

    const [category] = await this.database.db
      .insert(categories)
      .values({
        groupId: data.groupId,
        parentId: data.parentId ?? null,
        name: data.name,
        slug: data.slug,
        sortOrder: data.sortOrder ?? 0,
      })
      .returning();
    return category;
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
      .where(eq(categories.id, id))
      .returning();

    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async moveCategory(id: string, newParentId: string | null): Promise<Category> {
    const category = await this.findCategoryByIdOrFail(id);

    if (newParentId) {
      // Prevent moving to itself
      if (newParentId === id) {
        throw new ConflictException('A category cannot be its own parent');
      }

      const newParent = await this.findCategoryByIdOrFail(newParentId);

      // Must be in the same group
      if (newParent.groupId !== category.groupId) {
        throw new ConflictException('Cannot move category to a different group');
      }

      // Prevent cycles: walk up from newParent, ensure we don't hit the category being moved
      await this.ensureNoCycle(id, newParentId);
    }

    const [updated] = await this.database.db
      .update(categories)
      .set({ parentId: newParentId })
      .where(eq(categories.id, id))
      .returning();

    return updated;
  }

  async deleteCategory(id: string): Promise<void> {
    const category = await this.findCategoryById(id);
    if (!category) throw new NotFoundException('Category not found');

    // Check for children
    const [{ total }] = await this.database.db
      .select({ total: count() })
      .from(categories)
      .where(eq(categories.parentId, id));

    if (Number(total) > 0) {
      throw new ConflictException('Cannot delete a category that has children. Remove or move child categories first.');
    }

    await this.database.db.delete(categories).where(eq(categories.id, id));
  }

  async findCategoryById(id: string): Promise<Category | null> {
    const [category] = await this.database.db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
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
      .where(eq(categories.groupId, groupId))
      .orderBy(asc(categories.sortOrder), asc(categories.name));

    return this.buildTree(allCategories);
  }

  async getAncestors(id: string): Promise<Category[]> {
    const ancestors: Category[] = [];
    let current = await this.findCategoryByIdOrFail(id);

    while (current.parentId) {
      const parent = await this.findCategoryById(current.parentId);
      if (!parent) break;
      ancestors.unshift(parent);
      current = parent;
    }

    return ancestors;
  }

  // --- Validation (for domain modules) ---

  async validateCategoryInGroup(categoryId: string, groupSlug: string): Promise<Category> {
    const category = await this.findCategoryByIdOrFail(categoryId);

    const [group] = await this.database.db
      .select()
      .from(categoryGroups)
      .where(eq(categoryGroups.id, category.groupId))
      .limit(1);

    if (!group || group.slug !== groupSlug) {
      throw new ConflictException(`Category does not belong to group "${groupSlug}"`);
    }

    return category;
  }

  // --- Private helpers ---

  private buildTree(flatCategories: Category[]): CategoryTreeNode[] {
    const nodeMap = new Map<string, CategoryTreeNode>();
    const roots: CategoryTreeNode[] = [];

    // Create nodes
    for (const cat of flatCategories) {
      nodeMap.set(cat.id, { ...cat, children: [] });
    }

    // Build tree
    for (const cat of flatCategories) {
      const node = nodeMap.get(cat.id)!;
      if (cat.parentId && nodeMap.has(cat.parentId)) {
        nodeMap.get(cat.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  private async ensureNoCycle(movingId: string, targetParentId: string): Promise<void> {
    let currentId: string | null = targetParentId;

    while (currentId) {
      if (currentId === movingId) {
        throw new ConflictException('Moving this category would create a cycle');
      }
      const parent = await this.findCategoryById(currentId);
      currentId = parent?.parentId ?? null;
    }
  }
}
