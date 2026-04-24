import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type JwtPayload } from '@packages/auth';
import { AccessContext, RequirePermission, type DataAccessContext } from '@packages/rbac';
import { ValuePropsService } from '../services/value-props.service';
import { CreateValuePropSchema, UpdateValuePropSchema } from '../dto/value-props.dto';

@ApiTags('value-props')
@Controller('value-props')
export class ValuePropsController {
  constructor(private readonly svc: ValuePropsService) {}

  @Get('layout/list') @RequirePermission('value-props.read')
  getListLayout() { return this.svc.getListLayout(); }

  @Get() @RequirePermission('value-props.read')
  list(@Query() q: Record<string, unknown>, @AccessContext() c?: DataAccessContext) {
    return this.svc.list({ ...q, page: q.page ? Number(q.page) : undefined, limit: q.limit ? Number(q.limit) : undefined, includeDeleted: q.includeDeleted === 'true' }, c);
  }

  @Get(':id') @RequirePermission('value-props.read')
  findOne(@Param('id', ParseUUIDPipe) id: string, @AccessContext() c?: DataAccessContext) { return this.svc.findOne(id, c); }

  @Post() @RequirePermission('value-props.create') @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown, @CurrentUser() u: JwtPayload) { return this.svc.create(CreateValuePropSchema.parse(body), u.userId); }

  @Patch(':id') @RequirePermission('value-props.update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown, @CurrentUser() u: JwtPayload, @AccessContext() c?: DataAccessContext) {
    return this.svc.update(id, UpdateValuePropSchema.parse(body), u.userId, c);
  }

  @Delete(':id') @RequirePermission('value-props.delete') @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: JwtPayload, @AccessContext() c?: DataAccessContext) {
    await this.svc.softDelete(id, u.userId, c);
  }

  @Post(':id/clone') @RequirePermission('value-props.create') @HttpCode(HttpStatus.CREATED)
  clone(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: JwtPayload) { return this.svc.clone(id, u.userId); }

  @Post(':id/restore') @RequirePermission('value-props.update')
  restore(@Param('id', ParseUUIDPipe) id: string) { return this.svc.restore(id); }
}
