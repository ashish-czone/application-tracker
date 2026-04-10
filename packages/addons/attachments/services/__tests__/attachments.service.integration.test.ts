import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import { createPlatformTestModule, cleanDatabase } from '@packages/platform-testing';
import { sql } from '@packages/database';
import { users } from '@packages/database/schema';
import { AuditModule } from '@packages/audit';
import { MEDIA_MODULE_CONFIG, MediaService } from '@packages/media';
import { AttachmentsService } from '../attachments.service';
import { attachments } from '../../schema/attachments';
import type { DrizzleDB } from '@packages/database';
import type { TestingModule } from '@nestjs/testing';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

describe('AttachmentsService (integration)', () => {
  let module: TestingModule;
  let db: DrizzleDB;
  let cleanup: () => Promise<void>;
  let service: AttachmentsService;
  let uploaderId: string;
  let otherUserId: string;
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'attachments-test-'));

    const ctx = await createPlatformTestModule({
      imports: [AuditModule],
      providers: [
        {
          provide: MEDIA_MODULE_CONFIG,
          useValue: {
            provider: 'local',
            localPath: tmpDir,
            baseUrl: 'http://localhost:3000/files',
            maxFileSize: 10 * 1024 * 1024,
          },
        },
        MediaService,
        AttachmentsService,
      ],
    });
    module = ctx.module;
    db = ctx.db;
    cleanup = ctx.cleanup;
    service = module.get(AttachmentsService);
  });

  afterEach(async () => {
    await cleanDatabase(db);
  });

  afterAll(async () => {
    await cleanup();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function createUser(firstName = 'Test'): Promise<string> {
    const id = randomUUID();
    await db.insert(users).values({
      id,
      email: `user-${id.slice(0, 8)}@test.com`,
      firstName,
      lastName: 'User',
      userType: 'internal',
    });
    return id;
  }

  async function seedUsers() {
    uploaderId = await createUser('Uploader');
    otherUserId = await createUser('Other');
  }

  /** Insert an attachment record directly into the DB. */
  async function insertAttachment(opts: {
    entityType?: string;
    entityId?: string;
    uploadedBy: string;
    fileKey?: string;
    originalName?: string;
    mimeType?: string;
    size?: number;
  }): Promise<string> {
    const id = randomUUID();
    await db.insert(attachments).values({
      id,
      entityType: opts.entityType ?? 'candidates',
      entityId: opts.entityId ?? randomUUID(),
      fileKey: opts.fileKey ?? `files/${randomUUID()}.pdf`,
      originalName: opts.originalName ?? 'test.pdf',
      mimeType: opts.mimeType ?? 'application/pdf',
      size: opts.size ?? 1024,
      uploadedBy: opts.uploadedBy,
    });
    return id;
  }

  // ---------- findById ----------

  describe('findById', () => {
    it('should return attachment with uploader info', async () => {
      await seedUsers();
      const id = await insertAttachment({ uploadedBy: uploaderId });

      const found = await service.findById(id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(id);
      expect(found!.uploader.firstName).toBe('Uploader');
    });

    it('should return null for non-existent attachment', async () => {
      const found = await service.findById(randomUUID());
      expect(found).toBeNull();
    });

    it('should return null for soft-deleted attachment', async () => {
      await seedUsers();
      const id = await insertAttachment({ uploadedBy: uploaderId });

      await service.softDelete(id, uploaderId);

      const found = await service.findById(id);
      expect(found).toBeNull();
    });
  });

  // ---------- findByIdOrFail ----------

  describe('findByIdOrFail', () => {
    it('should throw NotFoundException for missing attachment', async () => {
      await expect(service.findByIdOrFail(randomUUID()))
        .rejects.toThrow('Attachment not found');
    });
  });

  // ---------- softDelete ----------

  describe('softDelete', () => {
    it('should soft-delete an attachment', async () => {
      await seedUsers();
      const id = await insertAttachment({ uploadedBy: uploaderId });

      await service.softDelete(id, uploaderId);

      const [row] = await db
        .select({ deletedAt: attachments.deletedAt, deletedBy: attachments.deletedBy })
        .from(attachments)
        .where(sql`${attachments.id} = ${id}`);

      expect(row.deletedAt).not.toBeNull();
      expect(row.deletedBy).toBe(uploaderId);
    });

    it('should throw ForbiddenException for non-uploader', async () => {
      await seedUsers();
      const id = await insertAttachment({ uploadedBy: uploaderId });

      await expect(service.softDelete(id, otherUserId))
        .rejects.toThrow('Only the uploader can delete');
    });
  });

  // ---------- listForEntity ----------

  describe('listForEntity', () => {
    it('should return paginated attachments for an entity', async () => {
      await seedUsers();
      const entityId = randomUUID();

      for (let i = 0; i < 3; i++) {
        await insertAttachment({ entityId, uploadedBy: uploaderId, originalName: `file${i}.pdf` });
      }

      const result = await service.listForEntity('candidates', entityId);
      expect(result.data).toHaveLength(3);
      expect(result.meta.total).toBe(3);
    });

    it('should exclude soft-deleted attachments', async () => {
      await seedUsers();
      const entityId = randomUUID();

      const id1 = await insertAttachment({ entityId, uploadedBy: uploaderId });
      const id2 = await insertAttachment({ entityId, uploadedBy: uploaderId });

      await service.softDelete(id2, uploaderId);

      const result = await service.listForEntity('candidates', entityId);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(id1);
    });

    it('should not return attachments from other entities', async () => {
      await seedUsers();
      const e1 = randomUUID();
      const e2 = randomUUID();

      await insertAttachment({ entityId: e1, uploadedBy: uploaderId });
      await insertAttachment({ entityId: e2, uploadedBy: uploaderId });

      const result = await service.listForEntity('candidates', e1);
      expect(result.data).toHaveLength(1);
    });

    it('should paginate correctly', async () => {
      await seedUsers();
      const entityId = randomUUID();

      for (let i = 0; i < 5; i++) {
        await insertAttachment({ entityId, uploadedBy: uploaderId });
      }

      const page1 = await service.listForEntity('candidates', entityId, 1, 2);
      expect(page1.data).toHaveLength(2);
      expect(page1.meta.totalPages).toBe(3);
    });
  });

  // ---------- softDeleteAllForEntity ----------

  describe('softDeleteAllForEntity', () => {
    it('should soft-delete all attachments for an entity', async () => {
      await seedUsers();
      const entityId = randomUUID();

      await insertAttachment({ entityId, uploadedBy: uploaderId });
      await insertAttachment({ entityId, uploadedBy: uploaderId });

      await service.softDeleteAllForEntity('candidates', entityId, uploaderId);

      const result = await service.listForEntity('candidates', entityId);
      expect(result.data).toHaveLength(0);
    });

    it('should not affect attachments of other entities', async () => {
      await seedUsers();
      const e1 = randomUUID();
      const e2 = randomUUID();

      await insertAttachment({ entityId: e1, uploadedBy: uploaderId });
      await insertAttachment({ entityId: e2, uploadedBy: uploaderId });

      await service.softDeleteAllForEntity('candidates', e1, uploaderId);

      const result = await service.listForEntity('candidates', e2);
      expect(result.data).toHaveLength(1);
    });
  });

  // ---------- upload ----------

  describe('upload', () => {
    it('should upload file and create attachment record', async () => {
      await seedUsers();
      const entityId = randomUUID();
      const fileBuffer = Buffer.from('test file content');

      const result = await service.upload({
        entityType: 'candidates',
        entityId,
        file: {
          buffer: fileBuffer,
          originalname: 'resume.pdf',
          mimetype: 'application/pdf',
          size: fileBuffer.length,
        } as any,
        uploadedBy: uploaderId,
      });

      expect(result.id).toBeDefined();
      expect(result.originalName).toBe('resume.pdf');
      expect(result.mimeType).toBe('application/pdf');
      expect(result.entityId).toBe(entityId);
      expect(result.uploader.firstName).toBe('Uploader');
    });
  });
});
