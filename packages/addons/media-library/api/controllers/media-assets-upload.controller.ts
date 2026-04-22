import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type JwtPayload } from '@packages/auth-core';
import { RequirePermission } from '@packages/rbac';
import {
  MediaAssetsUploadService,
  type MediaAssetRecord,
} from '../services/media-assets-upload.service';

@ApiTags('media-assets')
@Controller('media-assets')
export class MediaAssetsUploadController {
  constructor(private readonly service: MediaAssetsUploadService) {}

  @Post('upload')
  @RequirePermission('media-assets.create')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Upload one file + create a MediaAsset row. Returns the asset including resolved URL and image dimensions.',
  })
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('altText') altText: string | undefined,
    @Body('caption') caption: string | undefined,
    @CurrentUser() user: JwtPayload,
  ): Promise<MediaAssetRecord> {
    MediaAssetsUploadService.validateFile(
      file
        ? {
            buffer: file.buffer,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
          }
        : undefined,
    );
    return this.service.upload({
      file: {
        buffer: file!.buffer,
        originalname: file!.originalname,
        mimetype: file!.mimetype,
        size: file!.size,
      },
      altText: altText?.trim() || undefined,
      caption: caption?.trim() || undefined,
      createdBy: user.userId,
    });
  }
}
