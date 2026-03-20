import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { CurrentUser, type JwtPayload } from '@packages/auth';
import { RequirePermission } from '@packages/rbac';
import { CandidatesService } from '../services/candidates.service';
import { CreateCandidateDto } from '../dto/create-candidate.dto';
import { UpdateCandidateDto } from '../dto/update-candidate.dto';
import { ListCandidatesQueryDto } from '../dto/list-candidates-query.dto';
import { CANDIDATES_PERMISSIONS } from '../permissions';

@ApiTags('candidates')
@Controller('candidates')
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

  @Get()
  @RequirePermission(CANDIDATES_PERMISSIONS.READ)
  @ApiOperation({ summary: 'List candidates with pagination, search, and filtering' })
  async list(@Query() query: ListCandidatesQueryDto) {
    return this.candidatesService.list(query);
  }

  @Get(':id')
  @RequirePermission(CANDIDATES_PERMISSIONS.READ)
  @ApiOperation({ summary: 'Get a single candidate by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.candidatesService.findOneOrFail(id);
  }

  @Post()
  @RequirePermission(CANDIDATES_PERMISSIONS.CREATE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new candidate' })
  async create(@Body() dto: CreateCandidateDto, @CurrentUser() user: JwtPayload) {
    return this.candidatesService.create(dto, user.userId);
  }

  @Patch(':id')
  @RequirePermission(CANDIDATES_PERMISSIONS.UPDATE)
  @ApiOperation({ summary: 'Update a candidate' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCandidateDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.candidatesService.update(id, dto, user.userId);
  }

  @Delete(':id')
  @RequirePermission(CANDIDATES_PERMISSIONS.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a candidate' })
  async delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    await this.candidatesService.softDelete(id, user.userId);
  }

  @Post(':id/restore')
  @RequirePermission(CANDIDATES_PERMISSIONS.UPDATE)
  @ApiOperation({ summary: 'Restore a soft-deleted candidate' })
  async restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.candidatesService.restore(id);
  }

  @Post(':id/resume')
  @RequirePermission(CANDIDATES_PERMISSIONS.UPDATE)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload or replace candidate resume' })
  async uploadResume(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.candidatesService.uploadResume(
      id,
      {
        originalname: file.originalname,
        mimetype: file.mimetype,
        buffer: file.buffer,
        size: file.size,
      },
      user.userId,
    );
  }

  @Post(':id/skills/:tagId')
  @RequirePermission(CANDIDATES_PERMISSIONS.UPDATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Attach a skill tag to a candidate' })
  async attachSkill(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tagId', ParseUUIDPipe) tagId: string,
  ) {
    await this.candidatesService.attachSkill(id, tagId);
  }

  @Delete(':id/skills/:tagId')
  @RequirePermission(CANDIDATES_PERMISSIONS.UPDATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Detach a skill tag from a candidate' })
  async detachSkill(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tagId', ParseUUIDPipe) tagId: string,
  ) {
    await this.candidatesService.detachSkill(id, tagId);
  }
}
