import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { sql } from 'drizzle-orm';
import { createPackageTestApp, withAuth, cleanDatabase, type PackageTestApp } from '@packages/platform-testing';
import { EntityEngineModule, FieldDefinitionService } from '@packages/entity-engine';
import { EntityLayoutModule } from '../../entity-layout.module';
import { EAV_PERMISSIONS } from '@packages/entity-engine/permissions';

const READ = [EAV_PERMISSIONS.READ];
const MANAGE = [...READ, EAV_PERMISSIONS.MANAGE];

describe('LayoutsController (integration)', () => {
  let ctx: PackageTestApp;
  const entityType = 'test_layouts';

  beforeAll(async () => {
    ctx = await createPackageTestApp({
      imports: [EntityEngineModule, EntityLayoutModule],
    });
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  beforeEach(async () => {
    await cleanDatabase(ctx.db);
    await ctx.module.get(FieldDefinitionService).reloadCache();
  });

  // ── Helpers ──────────────────────────────────────────────────

  async function createSection(overrides: Record<string, unknown> = {}) {
    const body = {
      name: `Section ${Date.now()}`,
      columns: 2,
      ...overrides,
    };
    const res = await request(ctx.httpServer)
      .post(`/api/v1/layouts/${entityType}/sections`)
      .set(withAuth(MANAGE))
      .send(body)
      .expect(201);
    return res.body;
  }

  async function seedFieldDefinition() {
    const id = randomUUID();
    await ctx.db.execute(
      sql`INSERT INTO field_definitions (id, entity_type, field_key, label, field_type, is_system, is_required, sort_order, updated_at)
          VALUES (${id}, ${entityType}, ${'field_' + Date.now()}, ${'Test Field'}, ${'text'}, ${false}, ${false}, ${0}, NOW())`,
    );
    return id;
  }

  // ── Get layout ──────────────────────────────────────────────────

  describe('GET /api/v1/layouts/:entityType', () => {
    it('should return an empty layout for a new entity type', async () => {
      const res = await request(ctx.httpServer)
        .get(`/api/v1/layouts/${entityType}`)
        .set(withAuth(READ))
        .expect(200);

      expect(res.body).toHaveProperty('sections');
      expect(Array.isArray(res.body.sections)).toBe(true);
    });

    it('should return layout with sections', async () => {
      await createSection({ name: 'Basic Info' });
      await createSection({ name: 'Additional Info' });

      const res = await request(ctx.httpServer)
        .get(`/api/v1/layouts/${entityType}`)
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.sections.length).toBe(2);
    });
  });

  // ── Sections CRUD ──────────────────────────────────────────────────

  describe('POST /api/v1/layouts/:entityType/sections', () => {
    it('should create a section', async () => {
      const res = await request(ctx.httpServer)
        .post(`/api/v1/layouts/${entityType}/sections`)
        .set(withAuth(MANAGE))
        .send({ name: 'Contact Info', columns: 2 })
        .expect(201);

      expect(res.body).toMatchObject({
        id: expect.any(String),
        name: 'Contact Info',
        columns: 2,
      });
    });

    it('should create a collapsible section', async () => {
      const res = await request(ctx.httpServer)
        .post(`/api/v1/layouts/${entityType}/sections`)
        .set(withAuth(MANAGE))
        .send({ name: 'Advanced', columns: 1, isCollapsible: true })
        .expect(201);

      expect(res.body.isCollapsible).toBe(true);
    });
  });

  describe('PATCH /api/v1/layouts/:entityType/sections/:sectionId', () => {
    it('should update a section name', async () => {
      const section = await createSection({ name: 'Old Name' });

      const res = await request(ctx.httpServer)
        .patch(`/api/v1/layouts/${entityType}/sections/${section.id}`)
        .set(withAuth(MANAGE))
        .send({ name: 'New Name' })
        .expect(200);

      expect(res.body.name).toBe('New Name');
    });

    it('should update column count', async () => {
      const section = await createSection({ columns: 2 });

      const res = await request(ctx.httpServer)
        .patch(`/api/v1/layouts/${entityType}/sections/${section.id}`)
        .set(withAuth(MANAGE))
        .send({ columns: 3 })
        .expect(200);

      expect(res.body.columns).toBe(3);
    });
  });

  describe('DELETE /api/v1/layouts/:entityType/sections/:sectionId', () => {
    it('should delete a section', async () => {
      const section = await createSection();

      await request(ctx.httpServer)
        .delete(`/api/v1/layouts/${entityType}/sections/${section.id}`)
        .set(withAuth(MANAGE))
        .expect(204);

      // Verify layout no longer has the section
      const res = await request(ctx.httpServer)
        .get(`/api/v1/layouts/${entityType}`)
        .set(withAuth(READ))
        .expect(200);

      const ids = res.body.sections.map((s: any) => s.id);
      expect(ids).not.toContain(section.id);
    });
  });

  // ── Section reordering ──────────────────────────────────────────────────

  describe('PUT /api/v1/layouts/:entityType/sections/reorder', () => {
    it('should reorder sections', async () => {
      const s1 = await createSection({ name: 'First' });
      const s2 = await createSection({ name: 'Second' });
      const s3 = await createSection({ name: 'Third' });

      await request(ctx.httpServer)
        .put(`/api/v1/layouts/${entityType}/sections/reorder`)
        .set(withAuth(MANAGE))
        .send({ orderedIds: [s3.id, s1.id, s2.id] })
        .expect(200);

      const res = await request(ctx.httpServer)
        .get(`/api/v1/layouts/${entityType}`)
        .set(withAuth(READ))
        .expect(200);

      const names = res.body.sections.map((s: any) => s.name);
      expect(names).toEqual(['Third', 'First', 'Second']);
    });
  });

  // ── Field assignment ──────────────────────────────────────────────────

  describe('POST /api/v1/layouts/:entityType/sections/:sectionId/fields', () => {
    it('should assign a field to a section', async () => {
      const section = await createSection();
      const fieldId = await seedFieldDefinition();

      await request(ctx.httpServer)
        .post(`/api/v1/layouts/${entityType}/sections/${section.id}/fields`)
        .set(withAuth(MANAGE))
        .send({ fieldId })
        .expect(201);
    });
  });

  describe('DELETE /api/v1/layouts/:entityType/sections/:sectionId/fields/:fieldId', () => {
    it('should remove a field from a section', async () => {
      const section = await createSection();
      const fieldId = await seedFieldDefinition();

      // Add field
      await request(ctx.httpServer)
        .post(`/api/v1/layouts/${entityType}/sections/${section.id}/fields`)
        .set(withAuth(MANAGE))
        .send({ fieldId })
        .expect(201);

      // Remove field
      await request(ctx.httpServer)
        .delete(`/api/v1/layouts/${entityType}/sections/${section.id}/fields/${fieldId}`)
        .set(withAuth(MANAGE))
        .expect(204);
    });
  });

  // ── Field reordering ──────────────────────────────────────────────────

  describe('PUT /api/v1/layouts/:entityType/sections/:sectionId/fields/reorder', () => {
    it('should reorder fields in a section', async () => {
      const section = await createSection();
      const fieldId1 = await seedFieldDefinition();
      const fieldId2 = await seedFieldDefinition();

      // Add both fields
      await request(ctx.httpServer)
        .post(`/api/v1/layouts/${entityType}/sections/${section.id}/fields`)
        .set(withAuth(MANAGE))
        .send({ fieldId: fieldId1 })
        .expect(201);
      await request(ctx.httpServer)
        .post(`/api/v1/layouts/${entityType}/sections/${section.id}/fields`)
        .set(withAuth(MANAGE))
        .send({ fieldId: fieldId2 })
        .expect(201);

      // Reorder
      await request(ctx.httpServer)
        .put(`/api/v1/layouts/${entityType}/sections/${section.id}/fields/reorder`)
        .set(withAuth(MANAGE))
        .send({ orderedFieldIds: [fieldId2, fieldId1] })
        .expect(200);
    });
  });

  // ── Auth ──────────────────────────────────────────────────

  describe('Auth enforcement', () => {
    it('should return 401 without auth', async () => {
      await request(ctx.httpServer)
        .get(`/api/v1/layouts/${entityType}`)
        .expect(401);
    });
  });
});
