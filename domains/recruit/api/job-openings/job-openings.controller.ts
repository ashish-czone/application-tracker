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
import { JobOpeningsService } from './job-openings.service';
import { CreateJobOpeningSchema, UpdateJobOpeningSchema } from './job-openings.dto';

@ApiTags('job-openings')
@Controller('job-openings')
export class JobOpeningsController {
  constructor(private readonly jobOpenings: JobOpeningsService) {}

  @Get('layout/list')
  @RequirePermission('job-openings.read')
  @ApiOperation({ summary: 'Get list layout config for job openings' })
  getListLayout() {
    return this.jobOpenings.getListLayout();
  }

  @Get()
  @RequirePermission('job-openings.read')
  @ApiOperation({ summary: 'List job openings' })
  list(@Query() query: Record<string, unknown>, @AccessContext() accessCtx?: DataAccessContext) {
    const parsed = {
      ...query,
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      includeDeleted: query.includeDeleted === 'true',
      annotateApplicationsFor:
        typeof query.annotateApplicationsFor === 'string' ? query.annotateApplicationsFor : undefined,
    };
    return this.jobOpenings.list(parsed, accessCtx);
  }

  @Get(':id')
  @RequirePermission('job-openings.read')
  @ApiOperation({ summary: 'Get a single job opening by ID' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    return this.jobOpenings.findOne(id, accessCtx);
  }

  @Post()
  @RequirePermission('job-openings.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new job opening' })
  create(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = CreateJobOpeningSchema.parse(body);
    return this.jobOpenings.create(input, user.userId);
  }

  @Patch(':id')
  @RequirePermission('job-openings.update')
  @ApiOperation({ summary: 'Update a job opening' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const input = UpdateJobOpeningSchema.parse(body);
    return this.jobOpenings.update(id, input, user.userId, accessCtx);
  }

  @Delete(':id')
  @RequirePermission('job-openings.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a job opening' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    await this.jobOpenings.softDelete(id, user.userId, accessCtx);
  }

  @Post(':id/clone')
  @RequirePermission('job-openings.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Clone a job opening' })
  clone(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.jobOpenings.clone(id, user.userId);
  }

  @Post(':id/restore')
  @RequirePermission('job-openings.update')
  @ApiOperation({ summary: 'Restore a soft-deleted job opening' })
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.jobOpenings.restore(id);
  }
}
