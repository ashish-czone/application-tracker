import {
  Controller,
  Post,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { CurrentUser, type JwtPayload } from '@packages/auth';
import { FieldDefinitionService } from '@packages/eav-attributes';
import { MediaService } from '../services/media.service';
import type { MediaFile } from '../types';

/**
 * Generic media upload controller.
 *
 * Uploads files to temporary storage (tmp/) with validation
 * based on field definitions. Files in tmp/ are auto-cleaned
 * after 24 hours. On entity create/update, files are moved
 * to their permanent location.
 */
@ApiTags('media')
@Controller('media')
export class MediaUploadController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly fieldDefinitionService: FieldDefinitionService,
  ) {}

  @Post('upload/:entityType/:fieldName')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a file to temporary storage' })
  async upload(
    @Param('entityType') entityType: string,
    @Param('fieldName') fieldName: string,
    @Query('entityId') entityId: string | undefined,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
  ): Promise<MediaFile> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // 1. Check permission: entityType.create if no entityId, entityType.update if entityId
    const action = entityId ? 'update' : 'create';
    const requiredPermission = `${entityType}.${action}`;
    const userPermissions: Record<string, string> = (user as any).permissions ?? {};

    if (!('*' in userPermissions) && !(requiredPermission in userPermissions)) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }

    // 2. Look up field definition to validate field exists and is a file type
    const fields = await this.fieldDefinitionService.listByEntity(entityType);
    const fieldDef = fields.find(f => f.fieldKey === fieldName);

    if (!fieldDef || fieldDef.fieldType !== 'file') {
      throw new BadRequestException(`'${fieldName}' is not a valid file field on '${entityType}'`);
    }

    // 3. Upload to tmp/ with validation from field definition
    return this.mediaService.uploadToTmp(
      {
        originalname: file.originalname,
        mimetype: file.mimetype,
        buffer: file.buffer,
        size: file.size,
      },
      fieldDef.fileAccept ?? [],
      fieldDef.fileMaxSize ?? undefined,
    );
  }
}
