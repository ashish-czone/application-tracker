import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type JwtPayload } from '@packages/auth';
import { AccessContext, RequirePermission, type DataAccessContext } from '@packages/rbac';
import { CaseStudiesService } from '../services/case-studies.service';
import { CreateCaseStudySchema, UpdateCaseStudySchema } from '../dto/case-studies.dto';

@ApiTags('case-studies')
@Controller('case-studies')
export class CaseStudiesController {
  constructor(private readonly svc: CaseStudiesService) {}

  @Get('layout/list') @RequirePermission('case-studies.read')
  getListLayout() { return this.svc.getListLayout(); }

  @Get() @RequirePermission('case-studies.read')
  list(@Query() q: Record<string, unknown>, @AccessContext() c?: DataAccessContext) {
    return this.svc.list({ ...q, page: q.page ? Number(q.page) : undefined, limit: q.limit ? Number(q.limit) : undefined, includeDeleted: q.includeDeleted === 'true' }, c);
  }

  @Get(':id') @RequirePermission('case-studies.read')
  findOne(@Param('id', ParseUUIDPipe) id: string, @AccessContext() c?: DataAccessContext) { return this.svc.findOne(id, c); }

  @Post() @RequirePermission('case-studies.create') @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown, @CurrentUser() u: JwtPayload) { return this.svc.create(CreateCaseStudySchema.parse(body), u.userId); }

  @Patch(':id') @RequirePermission('case-studies.update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown, @CurrentUser() u: JwtPayload, @AccessContext() c?: DataAccessContext) {
    return this.svc.update(id, UpdateCaseStudySchema.parse(body), u.userId, c);
  }

  @Delete(':id') @RequirePermission('case-studies.delete') @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: JwtPayload, @AccessContext() c?: DataAccessContext) {
    await this.svc.softDelete(id, u.userId, c);
  }

  @Post(':id/clone') @RequirePermission('case-studies.create') @HttpCode(HttpStatus.CREATED)
  clone(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: JwtPayload) { return this.svc.clone(id, u.userId); }

  @Post(':id/restore') @RequirePermission('case-studies.update')
  restore(@Param('id', ParseUUIDPipe) id: string) { return this.svc.restore(id); }
}
