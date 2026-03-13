# Taxonomy Package — Implementation Plan

## Context

The project needs a centralized, reusable taxonomy/categorization system so that shared reference data (industries, skills, certifications, etc.) is not hardcoded in every module. The system uses DB-driven configuration (tag types + tags managed via admin UI) and a delegate pattern so any module can register its own join table for tagging without the taxonomy package knowing about domain entities.

---

## Architecture

### Naming

| Concept | Prisma Model | DB Table | FK field |
|---|---|---|---|
| Category group | `TagType` | `tag_types` | `tagTypeSlug` |
| Category item | `Tag` | `tags` | `tagId` |
| Per-module join | `CandidateTag`, `JobTag`, etc. | `candidate_tags`, etc. | `candidateId`, `jobId`, etc. |
| Package | `packages/taxonomy` | — | — |

### Delegate Pattern

Each module that wants tagging:
1. Defines its own join table in its `schema.prisma` (e.g., `CandidateTag`)
2. Registers its Prisma delegate with `TaggingService` in `onModuleInit()`
3. Calls `TaggingService` methods (assign, remove, replace, list) in its service layer

The `TaggingService` never knows the concrete model name — it operates on the delegate interface.

### Single-Value vs Multi-Value

| Field behavior | Storage | Example |
|---|---|---|
| Single value, core to the entity | Column on entity table (`industry String`) + validation via `taxonomyService.exists()` | A candidate's industry |
| Multiple values, taggable | Join table via `TaggingService` | Skills, certifications |
| `TagType.allowMultiple` | Tells frontend: single select vs multi-select. Tells `TaggingService`: enforce one-tag-per-type or allow many | — |

---

## Prerequisites

Depends on infrastructure that must be built first:

- Root monorepo config (`package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`)
- `packages/database` (Prisma client, `collect-schemas.js`, `base.prisma`)
- `apps/api` (NestJS shell)
- `packages/rbac` (guards, decorators)
- `packages/auth-nestjs` (auth guard)
- `packages/common` (`PaginatedResponse<T>`)
- `modules/admin` (module shell for CRUD controllers)
- Test infrastructure (`test/utils/`, `test/factories/`, `test/setup/`)

---

## Schema

```prisma
// packages/taxonomy/schema.prisma

model TagType {
  id             String    @id @default(uuid())
  slug           String    @unique
  name           String
  description    String?
  isSystem       Boolean   @default(false)
  allowMultiple  Boolean   @default(false)
  isHierarchical Boolean   @default(false)
  tags           Tag[]
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  deletedAt      DateTime?

  @@map("tag_types")
}

model Tag {
  id          String    @id @default(uuid())
  tagTypeSlug String
  tagType     TagType   @relation(fields: [tagTypeSlug], references: [slug])
  value       String
  label       String
  sortOrder   Int       @default(0)
  isActive    Boolean   @default(true)
  metadata    Json?
  parentId    String?
  parent      Tag?      @relation("TagHierarchy", fields: [parentId], references: [id])
  children    Tag[]     @relation("TagHierarchy")
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?

  @@unique([tagTypeSlug, value])
  @@index([tagTypeSlug, isActive, sortOrder])
  @@map("tags")
}
```

**Module-side join table example:**

```prisma
// modules/candidates/schema.prisma (add to existing)

model CandidateTag {
  id          String    @id @default(uuid())
  candidateId String
  candidate   Candidate @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  tagId       String
  tag         Tag       @relation(fields: [tagId], references: [id])
  createdAt   DateTime  @default(now())

  @@unique([candidateId, tagId])
  @@index([tagId])
  @@map("candidate_tags")
}
```

---

## Package Structure

```
packages/taxonomy/
  package.json
  tsconfig.json
  schema.prisma
  types.ts                            # All interfaces: EntityTagConfig, inputs, filters
  permissions.ts                      # TAXONOMY_PERMISSIONS constant
  services/
    tagTypeService.ts                 # CRUD for TagType
    tagService.ts                     # CRUD for Tag
    taggingService.ts                 # Generic tag assignment via delegates
    __tests__/
      tagTypeService.unit.test.ts
      tagService.unit.test.ts
      taggingService.unit.test.ts
  taxonomy.module.ts                  # NestJS module
  index.ts                            # Public API exports
```

---

## Types

```ts
// packages/taxonomy/types.ts

interface EntityTagConfig {
  delegate: any;           // Prisma delegate (prisma.candidateTag, prisma.jobTag, etc.)
  entityIdField: string;   // "candidateId", "jobId"
  tagIdField: string;      // defaults to "tagId"
}

interface CreateTagTypeInput {
  slug: string;
  name: string;
  description?: string;
  isSystem?: boolean;
  allowMultiple?: boolean;
  isHierarchical?: boolean;
}

interface UpdateTagTypeInput {
  slug?: string;
  name?: string;
  description?: string;
  allowMultiple?: boolean;
  isHierarchical?: boolean;
}

interface ListTagTypesFilter {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

interface CreateTagInput {
  tagTypeSlug: string;
  value: string;
  label: string;
  sortOrder?: number;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
  parentId?: string;
}

interface UpdateTagInput {
  value?: string;
  label?: string;
  sortOrder?: number;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
  parentId?: string | null;
}

interface ListTagsFilter {
  tagTypeSlug: string;
  page?: number;
  limit?: number;
  isActive?: boolean;
  parentId?: string;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}
```

---

## Services

### TagTypeService

| Method | Description |
|---|---|
| `create(input)` | Validate slug uniqueness, create tag type |
| `findAll(filter)` | Paginated, excludes soft-deleted, search by name/slug |
| `findBySlug(slug)` | Throws NotFoundException if missing/deleted |
| `findByIdOrFail(id)` | Throws NotFoundException |
| `update(id, input)` | Protect system tag type slug changes |
| `softDelete(id)` | Reject if isSystem |

**Business rules:**
- System tag types (`isSystem: true`) cannot be deleted or have slug changed
- Slug lowercased before storage, must be unique
- All queries filter `deletedAt: null` by default

### TagService

| Method | Description |
|---|---|
| `create(input)` | Validate tag type exists, validate unique [tagTypeSlug, value], validate parent constraints |
| `findAll(filter)` | Paginated by tagTypeSlug, filters: isActive, parentId, search |
| `findByIdOrFail(id)` | Throws NotFoundException |
| `findByIds(ids)` | Batch fetch |
| `findByTagType(slug, includeInactive?)` | All tags for a type |
| `update(id, input)` | Validate uniqueness if value changed |
| `softDelete(id)` | Sets deletedAt + isActive=false |
| `reorder(tagTypeSlug, orderedIds)` | Bulk sortOrder update |

**Business rules:**
- Tag `value` lowercased/normalized before storage
- Cannot set `parentId` on a non-hierarchical tag type
- Cannot create circular parent-child references
- Parent must belong to same tag type

### TaggingService (Delegate Pattern)

| Method | Description |
|---|---|
| `registerEntity(entityName, config)` | Called by modules in onModuleInit, throws on duplicate |
| `assign(entityName, entityId, tagIds)` | Validate tags exist + active, enforce allowMultiple, createMany |
| `remove(entityName, entityId, tagIds)` | Delete matching join records |
| `replace(entityName, entityId, tagTypeSlug, tagIds)` | Transaction: remove all tags of type, assign new |
| `listForEntity(entityName, entityId, tagTypeSlug?)` | Return assigned Tag records |
| `listEntitiesWithTag(entityName, tagId)` | Return entity IDs with tag |
| `listEntitiesWithAnyTags(entityName, tagIds)` | OR query |
| `listEntitiesWithAllTags(entityName, tagIds)` | AND query |
| `removeAllForEntity(entityName, entityId)` | Cleanup on entity delete |

**allowMultiple enforcement:** When assigning tags from a tag type with `allowMultiple: false`, only one tag of that type is allowed per entity. Existing tag of that type is replaced. Multiple tags of the same single-select type in one call throws `BadRequestException`.

---

## Admin API Endpoints

```
GET    /api/v1/admin/tag-types                     # List (paginated)
POST   /api/v1/admin/tag-types                     # Create
GET    /api/v1/admin/tag-types/:id                 # Get by ID
PATCH  /api/v1/admin/tag-types/:id                 # Update
DELETE /api/v1/admin/tag-types/:id                 # Soft delete

GET    /api/v1/admin/tag-types/:slug/tags          # List tags for type
POST   /api/v1/admin/tag-types/:slug/tags          # Create tag under type
GET    /api/v1/admin/tags/:id                      # Get tag by ID
PATCH  /api/v1/admin/tags/:id                      # Update tag
DELETE /api/v1/admin/tags/:id                      # Soft delete tag
PATCH  /api/v1/admin/tag-types/:slug/tags/reorder  # Reorder tags
```

### Permissions

```ts
export const TAXONOMY_PERMISSIONS = {
  TAG_TYPES_READ: 'taxonomy.tag-types.read',
  TAG_TYPES_CREATE: 'taxonomy.tag-types.create',
  TAG_TYPES_UPDATE: 'taxonomy.tag-types.update',
  TAG_TYPES_DELETE: 'taxonomy.tag-types.delete',
  TAGS_READ: 'taxonomy.tags.read',
  TAGS_CREATE: 'taxonomy.tags.create',
  TAGS_UPDATE: 'taxonomy.tags.update',
  TAGS_DELETE: 'taxonomy.tags.delete',
} as const;
```

### DTOs (in modules/admin/dto/)

**CreateTagTypeDto:** slug (`@Matches(/^[a-z0-9-]+$/)`), name, description?, isSystem?, allowMultiple?, isHierarchical?

**CreateTagDto:** value, label, sortOrder?, isActive?, metadata?, parentId?

**ListTagTypesQueryDto / ListTagsQueryDto:** Standard pagination + search + sort + order

**ReorderTagsDto:** orderedIds (`@IsArray()`, `@IsUUID('4', { each: true })`)

---

## Admin Files

```
modules/admin/
  controllers/
    tag-types.controller.ts
    tags.controller.ts
    __tests__/
      tag-types.integration.test.ts
      tag-types.security.test.ts
      tags.integration.test.ts
      tags.security.test.ts
  dto/
    tag-type/
      create-tag-type.dto.ts
      update-tag-type.dto.ts
      list-tag-types-query.dto.ts
    tag/
      create-tag.dto.ts
      update-tag.dto.ts
      list-tags-query.dto.ts
      reorder-tags.dto.ts
```

---

## Seed Data

System tag types seeded via `packages/database/prisma/seeds/taxonomy.seed.ts`. Uses upsert for idempotency. Initial types:

- `industry` — Technology, Healthcare, Finance, Manufacturing, Retail, Education
- `skill` — JavaScript, TypeScript, Python, Project Management (hierarchical)
- `certification` — empty, admin-managed

---

## Module Registration Example

```ts
// modules/candidates/candidates.module.ts
@Module({ imports: [TaxonomyModule], providers: [CandidatesService] })
export class CandidatesModule implements OnModuleInit {
  constructor(
    private taggingService: TaggingService,
    private prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.taggingService.registerEntity('candidate', {
      delegate: this.prisma.candidateTag,
      entityIdField: 'candidateId',
      tagIdField: 'tagId',
    });
  }
}

// modules/candidates/services/candidatesService.ts
async addTags(candidateId: string, tagIds: string[]) {
  await this.taggingService.assign('candidate', candidateId, tagIds);
}

async getSkills(candidateId: string) {
  return this.taggingService.listForEntity('candidate', candidateId, 'skill');
}
```

---

## Task Breakdown

Each task = its own branch -> implement -> PR -> merge -> next task.

| # | Branch | What | Tests |
|---|---|---|---|
| 0 | `chore/monorepo-foundation` | Root config, packages/database, apps/api, rbac, auth stubs, admin shell, test infra | — |
| 1 | `feat/taxonomy-schema` | schema.prisma + migration | — |
| 2 | `feat/taxonomy-tag-type-service` | TagTypeService + types + NestJS module | 12 unit tests |
| 3 | `feat/taxonomy-tag-service` | TagService | 15 unit tests |
| 4 | `feat/taxonomy-tagging-service` | TaggingService (delegate pattern) | 16 unit tests |
| 5 | `feat/taxonomy-admin-api` | Controllers + DTOs + permissions | 20 integration + 14 security tests |
| 6 | `feat/taxonomy-seed-data` | Seed script for system tag types | — |

**Dependency chain:** `0 → 1 → 2 → 3 → 4 → 5 → 6` (strictly sequential)

---

## Public API (`packages/taxonomy/index.ts`)

```ts
// Module
export { TaxonomyModule } from './taxonomy.module';

// Services
export { TagTypeService } from './services/tagTypeService';
export { TagService } from './services/tagService';
export { TaggingService } from './services/taggingService';

// Types
export type {
  EntityTagConfig,
  CreateTagTypeInput, UpdateTagTypeInput, ListTagTypesFilter,
  CreateTagInput, UpdateTagInput, ListTagsFilter,
} from './types';

// Permissions
export { TAXONOMY_PERMISSIONS } from './permissions';
```

---

## Future Considerations

- **Public read endpoints** for non-admin users (dropdowns) at `GET /api/v1/tag-types/:slug/tags`
- **Frontend `useTaxonomy(slug)` hook** for generic dropdown population
- **Caching** tag types/tags in memory (they change rarely)
