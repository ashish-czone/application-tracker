import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type JwtPayload } from '@packages/auth';
import { AccessContext, RequirePermission, type DataAccessContext } from '@packages/rbac';
import { StatsService } from '../services/stats.service';
import { CreateStatSchema, UpdateStatSchema } from '../dto/stats.dto';

@ApiTags('stats')
@Controller('stats')
export class StatsController {
  constructor(private readonly svc: StatsService) {}

  @Get('layout/list') @RequirePermission('stats.read')
  getListLayout() { return this.svc.getListLayout(); }

  @Get() @RequirePermission('stats.read')
  list(@Query() q: Record<string, unknown>, @AccessContext() c?: DataAccessContext) {
    return this.svc.list({ ...q, page: q.page ? Number(q.page) : undefined, limit: q.limit ? Number(q.limit) : undefined, includeDeleted: q.includeDeleted === 'true' }, c);
  }

  @Get(':id') @RequirePermission('stats.read')
  findOne(@Param('id', ParseUUIDPipe) id: string, @AccessContext() c?: DataAccessContext) { return this.svc.findOne(id, c); }

  @Post() @RequirePermission('stats.create') @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown, @CurrentUser() u: JwtPayload) { return this.svc.create(CreateStatSchema.parse(body), u.userId); }

  @Patch(':id') @RequirePermission('stats.update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown, @CurrentUser() u: JwtPayload, @AccessContext() c?: DataAccessContext) {
    return this.svc.update(id, UpdateStatSchema.parse(body), u.userId, c);
  }

  @Delete(':id') @RequirePermission('stats.delete') @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: JwtPayload, @AccessContext() c?: DataAccessContext) {
    await this.svc.softDelete(id, u.userId, c);
  }

  @Post(':id/clone') @RequirePermission('stats.create') @HttpCode(HttpStatus.CREATED)
  clone(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: JwtPayload) { return this.svc.clone(id, u.userId); }

  @Post(':id/restore') @RequirePermission('stats.update')
  restore(@Param('id', ParseUUIDPipe) id: string) { return this.svc.restore(id); }
}
