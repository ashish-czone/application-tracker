import { Controller, Get, Post, Delete, Body, Param, Query, HttpCode, HttpStatus, UseInterceptors, UploadedFile as UploadedFileDecorator } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { RequirePermission } from '@packages/rbac';
import { CurrentUser, type JwtPayload } from '@packages/auth-core';
import { EntityRegistryService } from '@packages/entity-engine';
import type { UploadedFile } from '@packages/media';
import { ATTACHMENTS_PERMISSIONS } from '../permissions';
import { readAttachmentsFeature } from '../feature';
import { AttachmentsService } from '../services/attachments.service';
import { UploadAttachmentDto } from '../dto/upload-attachment.dto';
import { ListAttachmentsQueryDto } from '../dto/list-attachments-query.dto';

@ApiTags('attachments')
@Controller('attachments')
export class AttachmentsController {
  constructor(
    private readonly attachmentsService: AttachmentsService,
    private readonly entityRegistry: EntityRegistryService,
  ) {}

  @Get()
  @RequirePermission(ATTACHMENTS_PERMISSIONS.READ)
  @ApiOperation({ summary: 'List attachments for an entity' })
  list(@Query() query: ListAttachmentsQueryDto) {
    return this.attachmentsService.listForEntity(
      query.entityType,
      query.entityId,
      query.page,
      query.limit,
    );
  }

  @Get(':id/url')
  @RequirePermission(ATTACHMENTS_PERMISSIONS.READ)
  @ApiOperation({ summary: 'Get download URL for an attachment' })
  getDownloadUrl(@Param('id') id: string) {
    return this.attachmentsService.getDownloadUrl(id);
  }

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(ATTACHMENTS_PERMISSIONS.CREATE)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload an attachment' })
  upload(
    @CurrentUser() user: JwtPayload,
    @UploadedFileDecorator() file: UploadedFile,
    @Body() dto: UploadAttachmentDto,
  ) {
    const entityConfig = this.entityRegistry.get(dto.entityType);
    const feature = readAttachmentsFeature(entityConfig?.features);

    return this.attachmentsService.upload({
      entityType: dto.entityType,
      entityId: dto.entityId,
      file,
      uploadedBy: user.userId,
      config: feature && {
        maxFileSize: feature.maxFileSize,
        acceptedMimeTypes: feature.acceptedMimeTypes,
        deleteMode: feature.deleteMode,
      },
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(ATTACHMENTS_PERMISSIONS.DELETE)
  @ApiOperation({ summary: 'Delete an attachment' })
  async remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    // Look up the attachment to find its entity type, then check entity config for deleteMode
    const attachment = await this.attachmentsService.findByIdOrFail(id);
    const entityConfig = this.entityRegistry.get(attachment.entityType);
    const deleteMode = readAttachmentsFeature(entityConfig?.features)?.deleteMode ?? 'soft';

    await this.attachmentsService.deleteByMode(id, user.userId, deleteMode);
  }
}
