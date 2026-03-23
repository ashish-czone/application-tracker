import {
  Controller,
  Post,
  Delete,
  Param,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  Inject,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { CurrentUser, type JwtPayload } from '@packages/auth';
import { RequirePermission } from '@packages/rbac';
import { EntityService } from '@packages/entity-engine';
import { MediaService, type MediaFile, type UploadedFile as MediaUploadedFile } from '@packages/media';
import { TaxonomyService } from '@packages/taxonomy';
import { DatabaseService, eq } from '@packages/database';
import { candidates } from '../schema/candidates';

const ENTITY_TYPE = 'candidate';
const SERVICE_TOKEN = 'ENTITY_SERVICE_candidates';

function resumeFieldConfig(candidateId: string) {
  return {
    entityType: ENTITY_TYPE,
    entityId: candidateId,
    fieldName: 'resume',
    maxFiles: 1,
    accept: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    maxFileSize: 10 * 1024 * 1024,
  };
}

/**
 * Domain-specific endpoints for candidates that go beyond generic CRUD.
 * Resume upload and skill tag management.
 */
@ApiTags('candidates')
@Controller('candidates')
export class CandidatesExtrasController {
  constructor(
    @Inject(SERVICE_TOKEN) private readonly entityService: EntityService,
    private readonly mediaService: MediaService,
    private readonly taxonomyService: TaxonomyService,
    private readonly database: DatabaseService,
  ) {}

  @Post(':id/resume')
  @RequirePermission('candidates.update')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload or replace candidate resume' })
  async uploadResume(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
  ) {
    const candidate = await this.entityService.findOneOrFail(id);
    const existingResume = candidate.resumeFile as MediaFile | null;

    const mediaFile = await this.mediaService.uploadSingle(
      { originalname: file.originalname, mimetype: file.mimetype, buffer: file.buffer, size: file.size },
      resumeFieldConfig(id),
      existingResume,
    );

    const [updated] = await this.database.db
      .update(candidates)
      .set({ resumeFile: mediaFile })
      .where(eq(candidates.id, id))
      .returning();

    return this.entityService.findOneOrFail(id);
  }

  @Post(':id/skills/:tagId')
  @RequirePermission('candidates.update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Attach a skill tag to a candidate' })
  async attachSkill(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tagId', ParseUUIDPipe) tagId: string,
  ) {
    await this.entityService.findOneOrFail(id);
    await this.taxonomyService.attachTag(ENTITY_TYPE, id, tagId);
  }

  @Delete(':id/skills/:tagId')
  @RequirePermission('candidates.update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Detach a skill tag from a candidate' })
  async detachSkill(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tagId', ParseUUIDPipe) tagId: string,
  ) {
    await this.entityService.findOneOrFail(id);
    await this.taxonomyService.detachTag(ENTITY_TYPE, id, tagId);
  }
}
