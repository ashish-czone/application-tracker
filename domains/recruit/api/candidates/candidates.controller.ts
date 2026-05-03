import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type JwtPayload } from '@packages/auth';
import {
  AccessContext,
  RequirePermission,
  type DataAccessContext,
} from '@packages/rbac';
import { CandidatesService } from './candidates.service';
import { CreateCandidateSchema, UpdateCandidateSchema } from './candidates.dto';

@ApiTags('candidates')
@Controller('candidates')
export class CandidatesController {
  constructor(private readonly candidates: CandidatesService) {}

  @Get('layout/list')
  @RequirePermission('candidates.read')
  @ApiOperation({ summary: 'Get list layout config for candidates' })
  getListLayout() {
    return this.candidates.getListLayout();
  }

  @Get()
  @RequirePermission('candidates.read')
  @ApiOperation({ summary: 'List candidates' })
  list(@Query() query: Record<string, unknown>, @AccessContext() accessCtx?: DataAccessContext) {
    const parsed = {
      ...query,
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      includeDeleted: query.includeDeleted === 'true',
      annotateApplicationsFor:
        typeof query.annotateApplicationsFor === 'string' ? query.annotateApplicationsFor : undefined,
    };
    return this.candidates.list(parsed, accessCtx);
  }

  @Get(':id')
  @RequirePermission('candidates.read')
  @ApiOperation({ summary: 'Get a single candidate by ID' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    return this.candidates.findOne(id, accessCtx);
  }

  @Post()
  @RequirePermission('candidates.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new candidate' })
  create(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = CreateCandidateSchema.parse(body);
    return this.candidates.create(input, user.userId);
  }

  @Patch(':id')
  @RequirePermission('candidates.update')
  @ApiOperation({ summary: 'Update a candidate' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const input = UpdateCandidateSchema.parse(body);
    return this.candidates.update(id, input, user.userId, accessCtx);
  }

  @Delete(':id')
  @RequirePermission('candidates.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a candidate' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    await this.candidates.softDelete(id, user.userId, accessCtx);
  }

  @Post(':id/clone')
  @RequirePermission('candidates.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Clone a candidate' })
  clone(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.candidates.clone(id, user.userId);
  }

  @Post(':id/restore')
  @RequirePermission('candidates.update')
  @ApiOperation({ summary: 'Restore a soft-deleted candidate' })
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.candidates.restore(id);
  }
}
