import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createPackageTestApp, withAuth, cleanDatabase, type PackageTestApp } from '@packages/platform-testing';
import { EntityEngineModule } from '../../entity-engine.module';
import { EntityRegistryService } from '../../entity-registry.service';
import { EAV_PERMISSIONS } from '../../permissions';

const READ = [EAV_PERMISSIONS.READ];
const MANAGE = [...READ, EAV_PERMISSIONS.MANAGE];

describe('FieldsController (integration)', () => {
  let ctx: PackageTestApp;

  beforeAll(async () => {
    ctx = await createPackageTestApp({
      imports: [EntityEngineModule],
    });

    // Register a test entity with customFields enabled
    const registry = ctx.module.get(EntityRegistryService);
    registry.register({
      entityType: 'test_entity',
      singularName: 'Test Entity',
      pluralName: 'Test Entities',
      slug: 'test-entities',
      table: {} as any,
      columns: {},
      fieldMeta: {},
      customFields: true,
    });
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  beforeEach(async () => {
    await cleanDatabase(ctx.db);
  });

  // ── Helpers ──────────────────────────────────────────────────

  let seq = 0;

  async function createField(overrides: Record<string, unknown> = {}) {
    seq++;
    const body = {
      entityType: 'test_entity',
      fieldKey: `custom_field_${Date.now()}_${seq}`,
      label: `Custom Field ${seq}`,
      fieldType: 'text',
      ...overrides,
    };
    const res = await request(ctx.httpServer)
      .post('/api/v1/fields')
      .set(withAuth(MANAGE))
      .send(body)
      .expect(201);
    return res.body;
  }

  // ── Field types ──────────────────────────────────────────────────

  describe('GET /api/v1/fields/types', () => {
    it('should list registered field types', async () => {
      const res = await request(ctx.httpServer)
        .get('/api/v1/fields/types')
        .set(withAuth(READ))
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      const types = res.body.map((ft: any) => ft.type);
      expect(types).toContain('text');
      expect(types).toContain('number');
      expect(types).toContain('lookup');
      expect(types).toContain('boolean');
    });

    it('should include metadata for each type', async () => {
      const res = await request(ctx.httpServer)
        .get('/api/v1/fields/types')
        .set(withAuth(READ))
        .expect(200);

      const textType = res.body.find((ft: any) => ft.type === 'text');
      expect(textType).toHaveProperty('label');
      expect(textType).toHaveProperty('creatable');
    });
  });

  // ── CRUD ──────────────────────────────────────────────────

  describe('POST /api/v1/fields', () => {
    it('should create a custom text field', async () => {
      const res = await request(ctx.httpServer)
        .post('/api/v1/fields')
        .set(withAuth(MANAGE))
        .send({
          entityType: 'test_entity',
          fieldKey: 'bio',
          label: 'Biography',
          fieldType: 'textarea',
        })
        .expect(201);

      expect(res.body).toMatchObject({
        id: expect.any(String),
        fieldKey: 'bio',
        label: 'Biography',
        fieldType: 'textarea',
        entityType: 'test_entity',
      });
    });

    it('should create a number field with options', async () => {
      const res = await request(ctx.httpServer)
        .post('/api/v1/fields')
        .set(withAuth(MANAGE))
        .send({
          entityType: 'test_entity',
          fieldKey: 'age',
          label: 'Age',
          fieldType: 'number',
          isRequired: true,
        })
        .expect(201);

      expect(res.body.isRequired).toBe(true);
      expect(res.body.fieldType).toBe('number');
    });

    it('should reject field for entity without customFields', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/fields')
        .set(withAuth(MANAGE))
        .send({
          entityType: 'nonexistent_entity',
          fieldKey: 'test',
          label: 'Test',
          fieldType: 'text',
        })
        .expect(400);
    });
  });

  describe('GET /api/v1/fields', () => {
    it('should list fields for an entity type', async () => {
      await createField({ fieldKey: 'field_a', label: 'Field A' });
      await createField({ fieldKey: 'field_b', label: 'Field B' });

      const res = await request(ctx.httpServer)
        .get('/api/v1/fields?entityType=test_entity')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('GET /api/v1/fields/:id', () => {
    it('should return a field by id', async () => {
      const field = await createField({ fieldKey: 'specific_field', label: 'Specific' });

      const res = await request(ctx.httpServer)
        .get(`/api/v1/fields/${field.id}`)
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.label).toBe('Specific');
    });
  });

  describe('PATCH /api/v1/fields/:id', () => {
    it('should update a field label', async () => {
      const field = await createField();

      const res = await request(ctx.httpServer)
        .patch(`/api/v1/fields/${field.id}`)
        .set(withAuth(MANAGE))
        .send({ label: 'Updated Label' })
        .expect(200);

      expect(res.body.label).toBe('Updated Label');
    });

    it('should update isRequired', async () => {
      const field = await createField();

      const res = await request(ctx.httpServer)
        .patch(`/api/v1/fields/${field.id}`)
        .set(withAuth(MANAGE))
        .send({ isRequired: true })
        .expect(200);

      expect(res.body.isRequired).toBe(true);
    });
  });

  describe('DELETE /api/v1/fields/:id', () => {
    it('should delete a field', async () => {
      const field = await createField();

      await request(ctx.httpServer)
        .delete(`/api/v1/fields/${field.id}`)
        .set(withAuth(MANAGE))
        .expect(204);
    });
  });

  // ── Picklist options ──────────────────────────────────────────────────

  describe('Picklist options', () => {
    it('should set and get picklist options', async () => {
      const field = await createField({ fieldKey: 'status_field', fieldType: 'picklist' });

      // Set options
      await request(ctx.httpServer)
        .post(`/api/v1/fields/${field.id}/options`)
        .set(withAuth(MANAGE))
        .send({
          options: [
            { label: 'Active', value: 'active', isDefault: true },
            { label: 'Inactive', value: 'inactive' },
          ],
        })
        .expect(204);

      // Get options
      const res = await request(ctx.httpServer)
        .get(`/api/v1/fields/${field.id}/options`)
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.length).toBe(2);
      expect(res.body[0]).toMatchObject({ label: 'Active', value: 'active' });
    });
  });

  // ── Auth ──────────────────────────────────────────────────

  describe('Auth enforcement', () => {
    it('should return 401 without auth', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/fields/types')
        .expect(401);
    });
  });
});
