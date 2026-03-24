import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService, eq, and, inArray, count, ilike, asc, desc } from '@packages/database';
import type { PaginatedResponse } from '@packages/common';
import { tagGroups } from '../schema/tag-groups';
import { tags } from '../schema/tags';
import { entityTags } from '../schema/entity-tags';
import type { TagGroup, Tag, TagWithGroup } from '../types';

@Injectable()
export class TaxonomyService {
  constructor(private readonly database: DatabaseService) {}

  // --- Tag Groups ---

  async createTagGroup(data: { name: string; slug: string; description?: string; allowMultiple?: boolean }): Promise<TagGroup> {
    const [group] = await this.database.db
      .insert(tagGroups)
      .values({
        name: data.name,
        slug: data.slug,
        description: data.description ?? null,
        allowMultiple: data.allowMultiple ?? true,
      })
      .returning();
    return group;
  }

  async updateTagGroup(id: string, data: { name?: string; slug?: string; description?: string; allowMultiple?: boolean }): Promise<TagGroup> {
    const updateValues: Record<string, unknown> = {};
    if (data.name !== undefined) updateValues.name = data.name;
    if (data.slug !== undefined) updateValues.slug = data.slug;
    if (data.description !== undefined) updateValues.description = data.description;
    if (data.allowMultiple !== undefined) updateValues.allowMultiple = data.allowMultiple;

    if (Object.keys(updateValues).length === 0) {
      return this.findTagGroupByIdOrFail(id);
    }

    const [group] = await this.database.db
      .update(tagGroups)
      .set(updateValues)
      .where(eq(tagGroups.id, id))
      .returning();

    if (!group) throw new NotFoundException('Tag group not found');
    return group;
  }

  async deleteTagGroup(id: string): Promise<void> {
    const group = await this.findTagGroupById(id);
    if (!group) throw new NotFoundException('Tag group not found');

    // Check if any tags in this group are attached to entities
    const [{ total }] = await this.database.db
      .select({ total: count() })
      .from(entityTags)
      .innerJoin(tags, eq(tags.id, entityTags.tagId))
      .where(eq(tags.tagGroupId, id));

    if (Number(total) > 0) {
      throw new ConflictException('Cannot delete a tag group that has tags attached to entities. Remove all tag assignments first.');
    }

    await this.database.db.delete(tagGroups).where(eq(tagGroups.id, id));
  }

  async findTagGroupById(id: string): Promise<TagGroup | null> {
    const [group] = await this.database.db
      .select()
      .from(tagGroups)
      .where(eq(tagGroups.id, id))
      .limit(1);
    return group ?? null;
  }

  async findTagGroupByIdOrFail(id: string): Promise<TagGroup> {
    const group = await this.findTagGroupById(id);
    if (!group) throw new NotFoundException('Tag group not found');
    return group;
  }

  async listTagGroups(query: {
    page?: number;
    limit?: number;
    search?: string;
    sort?: 'name' | 'createdAt';
    order?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<TagGroup>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (query.search) {
      conditions.push(ilike(tagGroups.name, `%${query.search}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const sortColumn = { name: tagGroups.name, createdAt: tagGroups.createdAt }[query.sort ?? 'createdAt'];
    const orderFn = query.order === 'asc' ? asc : desc;

    const [{ total }] = await this.database.db
      .select({ total: count() })
      .from(tagGroups)
      .where(whereClause);

    const data = await this.database.db
      .select()
      .from(tagGroups)
      .where(whereClause)
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset(offset);

    return {
      data,
      meta: { total: Number(total), page, limit, totalPages: Math.ceil(Number(total) / limit) },
    };
  }

  // --- Tags ---

  async createTag(data: { tagGroupId: string; name: string; slug: string; color?: string }): Promise<Tag> {
    await this.findTagGroupByIdOrFail(data.tagGroupId);

    const [tag] = await this.database.db
      .insert(tags)
      .values({
        tagGroupId: data.tagGroupId,
        name: data.name,
        slug: data.slug,
        color: data.color ?? null,
      })
      .returning();
    return tag;
  }

  async updateTag(id: string, data: { name?: string; slug?: string; color?: string }): Promise<Tag> {
    const updateValues: Record<string, unknown> = {};
    if (data.name !== undefined) updateValues.name = data.name;
    if (data.slug !== undefined) updateValues.slug = data.slug;
    if (data.color !== undefined) updateValues.color = data.color;

    if (Object.keys(updateValues).length === 0) {
      return this.findTagByIdOrFail(id);
    }

    const [tag] = await this.database.db
      .update(tags)
      .set(updateValues)
      .where(eq(tags.id, id))
      .returning();

    if (!tag) throw new NotFoundException('Tag not found');
    return tag;
  }

  async deleteTag(id: string): Promise<void> {
    const tag = await this.findTagById(id);
    if (!tag) throw new NotFoundException('Tag not found');

    const [{ total }] = await this.database.db
      .select({ total: count() })
      .from(entityTags)
      .where(eq(entityTags.tagId, id));

    if (Number(total) > 0) {
      throw new ConflictException('Cannot delete a tag that is attached to entities. Remove all assignments first.');
    }

    await this.database.db.delete(tags).where(eq(tags.id, id));
  }

  async findTagById(id: string): Promise<Tag | null> {
    const [tag] = await this.database.db
      .select()
      .from(tags)
      .where(eq(tags.id, id))
      .limit(1);
    return tag ?? null;
  }

  async findTagByIdOrFail(id: string): Promise<Tag> {
    const tag = await this.findTagById(id);
    if (!tag) throw new NotFoundException('Tag not found');
    return tag;
  }

  async listTagsByGroup(tagGroupId: string): Promise<Tag[]> {
    await this.findTagGroupByIdOrFail(tagGroupId);
    return this.database.db
      .select()
      .from(tags)
      .where(eq(tags.tagGroupId, tagGroupId))
      .orderBy(asc(tags.name));
  }

  async listTagsByGroupSlug(slug: string): Promise<Tag[]> {
    const [group] = await this.database.db
      .select({ id: tagGroups.id })
      .from(tagGroups)
      .where(eq(tagGroups.slug, slug))
      .limit(1);

    if (!group) return [];

    return this.database.db
      .select()
      .from(tags)
      .where(eq(tags.tagGroupId, group.id))
      .orderBy(asc(tags.name));
  }

  // --- Entity Tags ---

  async attachTag(entityType: string, entityId: string, tagId: string): Promise<void> {
    const tag = await this.findTagByIdOrFail(tagId);

    // Check allowMultiple constraint
    const group = await this.findTagGroupByIdOrFail(tag.tagGroupId);
    if (!group.allowMultiple) {
      // Check if entity already has a tag from this group
      const existingFromGroup = await this.database.db
        .select({ tagId: entityTags.tagId })
        .from(entityTags)
        .innerJoin(tags, eq(tags.id, entityTags.tagId))
        .where(and(
          eq(entityTags.entityType, entityType),
          eq(entityTags.entityId, entityId),
          eq(tags.tagGroupId, group.id),
        ))
        .limit(1);

      if (existingFromGroup.length > 0 && existingFromGroup[0].tagId !== tagId) {
        throw new ConflictException(
          `Tag group "${group.name}" only allows one tag per entity. Remove the existing tag first.`,
        );
      }
    }

    await this.database.db
      .insert(entityTags)
      .values({ entityType, entityId, tagId })
      .onConflictDoNothing();
  }

  async detachTag(entityType: string, entityId: string, tagId: string): Promise<void> {
    await this.database.db
      .delete(entityTags)
      .where(and(
        eq(entityTags.entityType, entityType),
        eq(entityTags.entityId, entityId),
        eq(entityTags.tagId, tagId),
      ));
  }

  async getTagsForEntity(entityType: string, entityId: string): Promise<TagWithGroup[]> {
    return this.database.db
      .select({
        id: tags.id,
        tagGroupId: tags.tagGroupId,
        name: tags.name,
        slug: tags.slug,
        color: tags.color,
        createdAt: tags.createdAt,
        updatedAt: tags.updatedAt,
        groupName: tagGroups.name,
        groupSlug: tagGroups.slug,
      })
      .from(entityTags)
      .innerJoin(tags, eq(tags.id, entityTags.tagId))
      .innerJoin(tagGroups, eq(tagGroups.id, tags.tagGroupId))
      .where(and(eq(entityTags.entityType, entityType), eq(entityTags.entityId, entityId)))
      .orderBy(asc(tagGroups.name), asc(tags.name));
  }

  // --- Tag Loader (for domain modules) ---

  /**
   * Create a reusable tag loader for a specific entity type.
   * Returns a function that batch-loads tags for an array of entities and merges them in.
   *
   * Usage:
   * ```ts
   * const withTags = this.taxonomyService.createTagLoader('candidate');
   * const candidatesWithTags = await withTags(candidates);
   * ```
   */
  createTagLoader<T extends { id: string }>(entityType: string) {
    return async (entities: T[]): Promise<(T & { tags: TagWithGroup[] })[]> => {
      if (entities.length === 0) return [];

      const entityIds = entities.map((e) => e.id);

      const rows = await this.database.db
        .select({
          entityId: entityTags.entityId,
          id: tags.id,
          tagGroupId: tags.tagGroupId,
          name: tags.name,
          slug: tags.slug,
          color: tags.color,
          createdAt: tags.createdAt,
          updatedAt: tags.updatedAt,
          groupName: tagGroups.name,
          groupSlug: tagGroups.slug,
        })
        .from(entityTags)
        .innerJoin(tags, eq(tags.id, entityTags.tagId))
        .innerJoin(tagGroups, eq(tagGroups.id, tags.tagGroupId))
        .where(and(
          eq(entityTags.entityType, entityType),
          inArray(entityTags.entityId, entityIds),
        ))
        .orderBy(asc(tagGroups.name), asc(tags.name));

      // Group by entity ID
      const tagsByEntity = new Map<string, TagWithGroup[]>();
      for (const row of rows) {
        const list = tagsByEntity.get(row.entityId) ?? [];
        list.push({
          id: row.id,
          tagGroupId: row.tagGroupId,
          name: row.name,
          slug: row.slug,
          color: row.color,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          groupName: row.groupName,
          groupSlug: row.groupSlug,
        });
        tagsByEntity.set(row.entityId, list);
      }

      return entities.map((entity) => ({
        ...entity,
        tags: tagsByEntity.get(entity.id) ?? [],
      }));
    };
  }
}
