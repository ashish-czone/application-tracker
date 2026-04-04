import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { DatabaseService, eq, and, isNull, desc, count } from '@packages/database';
import { MediaService, isMimeTypeAccepted, isFileSizeValid, DEFAULT_MAX_FILE_SIZE } from '@packages/media';
import type { UploadedFile } from '@packages/media';
import { DomainEventEmitter } from '@packages/events';
import type { PaginatedResponse } from '@packages/common';
import { users } from '@packages/database/schema';
import { attachments } from '../schema/attachments';
import { ATTACHMENTS_ATTACHMENT_UPLOADED, ATTACHMENTS_ATTACHMENT_DELETED } from '../events/types';
import type { AttachmentWithUploader, AttachmentConfig } from '../types';

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly mediaService: MediaService,
    private readonly domainEventEmitter: DomainEventEmitter,
  ) {}

  async upload(data: {
    entityType: string;
    entityId: string;
    file: UploadedFile;
    uploadedBy: string;
    config?: AttachmentConfig;
  }): Promise<AttachmentWithUploader> {
    const { entityType, entityId, file, uploadedBy, config } = data;

    // Validate MIME type
    const acceptedTypes = config?.acceptedMimeTypes ?? ['*/*'];
    if (!isMimeTypeAccepted(file.mimetype, acceptedTypes)) {
      throw new BadRequestException(`File type "${file.mimetype}" is not accepted`);
    }

    // Validate file size
    const maxSize = config?.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
    if (!isFileSizeValid(file.size, maxSize)) {
      throw new BadRequestException(`File size exceeds maximum of ${Math.round(maxSize / 1024 / 1024)}MB`);
    }

    // Upload to storage via MediaService
    const mediaFile = await this.mediaService.upload(file, {
      entityType,
      entityId,
      fieldName: 'attachments',
      maxFiles: Infinity,
      maxFileSize: maxSize,
      accept: acceptedTypes,
    });

    // Insert attachment record
    const [attachment] = await this.database.db
      .insert(attachments)
      .values({
        entityType,
        entityId,
        fileKey: mediaFile.key,
        originalName: mediaFile.originalName,
        mimeType: mediaFile.mimeType,
        size: mediaFile.size,
        uploadedBy,
      })
      .returning();

    this.domainEventEmitter.emit(ATTACHMENTS_ATTACHMENT_UPLOADED, {
      entityType: 'attachments',
      entityId: attachment.id,
      actorId: uploadedBy,
      payload: {
        targetEntityType: entityType,
        targetEntityId: entityId,
        originalName: mediaFile.originalName,
        mimeType: mediaFile.mimeType,
        size: mediaFile.size,
      },
    });

    return this.findByIdOrFail(attachment.id);
  }

  async softDelete(id: string, actorId: string): Promise<void> {
    const existing = await this.findByIdOrFail(id);
    if (existing.uploadedBy !== actorId) {
      throw new ForbiddenException('Only the uploader can delete this attachment');
    }

    await this.database.db
      .update(attachments)
      .set({ deletedAt: new Date(), deletedBy: actorId })
      .where(eq(attachments.id, id));

    this.emitDeletedEvent(existing, actorId);
  }

  async hardDelete(id: string, actorId: string): Promise<void> {
    const existing = await this.findByIdOrFail(id);
    if (existing.uploadedBy !== actorId) {
      throw new ForbiddenException('Only the uploader can delete this attachment');
    }

    await this.mediaService.delete(existing.fileKey);
    await this.database.db
      .delete(attachments)
      .where(eq(attachments.id, id));

    this.emitDeletedEvent(existing, actorId);
  }

  async deleteByMode(id: string, actorId: string, mode: 'soft' | 'hard' = 'soft'): Promise<void> {
    if (mode === 'hard') {
      return this.hardDelete(id, actorId);
    }
    return this.softDelete(id, actorId);
  }

  async findById(id: string): Promise<AttachmentWithUploader | null> {
    const [row] = await this.database.db
      .select({
        id: attachments.id,
        entityType: attachments.entityType,
        entityId: attachments.entityId,
        fileKey: attachments.fileKey,
        originalName: attachments.originalName,
        mimeType: attachments.mimeType,
        size: attachments.size,
        uploadedBy: attachments.uploadedBy,
        createdAt: attachments.createdAt,
        deletedAt: attachments.deletedAt,
        deletedBy: attachments.deletedBy,
        uploaderFirstName: users.firstName,
        uploaderLastName: users.lastName,
        uploaderEmail: users.email,
      })
      .from(attachments)
      .innerJoin(users, eq(attachments.uploadedBy, users.id))
      .where(and(eq(attachments.id, id), isNull(attachments.deletedAt)))
      .limit(1);

    if (!row) return null;
    return this.toAttachmentWithUploader(row);
  }

  async findByIdOrFail(id: string): Promise<AttachmentWithUploader> {
    const attachment = await this.findById(id);
    if (!attachment) throw new NotFoundException('Attachment not found');
    return attachment;
  }

  async listForEntity(
    entityType: string,
    entityId: string,
    page = 1,
    limit = 25,
  ): Promise<PaginatedResponse<AttachmentWithUploader>> {
    const offset = (page - 1) * limit;

    const [rows, [{ total }]] = await Promise.all([
      this.database.db
        .select({
          id: attachments.id,
          entityType: attachments.entityType,
          entityId: attachments.entityId,
          fileKey: attachments.fileKey,
          originalName: attachments.originalName,
          mimeType: attachments.mimeType,
          size: attachments.size,
          uploadedBy: attachments.uploadedBy,
          createdAt: attachments.createdAt,
          deletedAt: attachments.deletedAt,
          deletedBy: attachments.deletedBy,
          uploaderFirstName: users.firstName,
          uploaderLastName: users.lastName,
          uploaderEmail: users.email,
        })
        .from(attachments)
        .innerJoin(users, eq(attachments.uploadedBy, users.id))
        .where(and(
          eq(attachments.entityType, entityType),
          eq(attachments.entityId, entityId),
          isNull(attachments.deletedAt),
        ))
        .orderBy(desc(attachments.createdAt))
        .limit(limit)
        .offset(offset),

      this.database.db
        .select({ total: count() })
        .from(attachments)
        .where(and(
          eq(attachments.entityType, entityType),
          eq(attachments.entityId, entityId),
          isNull(attachments.deletedAt),
        )),
    ]);

    return {
      data: rows.map((row) => this.toAttachmentWithUploader(row)),
      meta: {
        total: Number(total),
        page,
        limit,
        totalPages: Math.ceil(Number(total) / limit),
      },
    };
  }

  async getDownloadUrl(id: string): Promise<{ url: string }> {
    const attachment = await this.findByIdOrFail(id);
    const url = await this.mediaService.getSignedUrl(attachment.fileKey);
    return { url };
  }

  /** Soft-delete all attachments for an entity (called by cleanup listener on entity deletion). */
  async softDeleteAllForEntity(entityType: string, entityId: string, actorId: string, tx?: any): Promise<void> {
    const db = tx ?? this.database.db;
    await db
      .update(attachments)
      .set({ deletedAt: new Date(), deletedBy: actorId })
      .where(and(
        eq(attachments.entityType, entityType),
        eq(attachments.entityId, entityId),
        isNull(attachments.deletedAt),
      ));
  }

  private emitDeletedEvent(attachment: AttachmentWithUploader, actorId: string): void {
    this.domainEventEmitter.emit(ATTACHMENTS_ATTACHMENT_DELETED, {
      entityType: 'attachments',
      entityId: attachment.id,
      actorId,
      payload: {
        targetEntityType: attachment.entityType,
        targetEntityId: attachment.entityId,
        originalName: attachment.originalName,
      },
    });
  }

  private toAttachmentWithUploader(row: {
    id: string;
    entityType: string;
    entityId: string;
    fileKey: string;
    originalName: string;
    mimeType: string;
    size: number;
    uploadedBy: string;
    createdAt: Date;
    deletedAt: Date | null;
    deletedBy: string | null;
    uploaderFirstName: string;
    uploaderLastName: string;
    uploaderEmail: string;
  }): AttachmentWithUploader {
    return {
      id: row.id,
      entityType: row.entityType,
      entityId: row.entityId,
      fileKey: row.fileKey,
      originalName: row.originalName,
      mimeType: row.mimeType,
      size: row.size,
      uploadedBy: row.uploadedBy,
      createdAt: row.createdAt,
      deletedAt: row.deletedAt,
      deletedBy: row.deletedBy,
      uploader: {
        id: row.uploadedBy,
        firstName: row.uploaderFirstName,
        lastName: row.uploaderLastName,
        email: row.uploaderEmail,
      },
    };
  }
}
