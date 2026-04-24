import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, type JwtPayload } from '@packages/auth';
import { AccessContext, RequirePermission, type DataAccessContext } from '@packages/rbac';
import { SubscriptionPlansService } from '../services/subscription-plans.service';
import { CreateSubscriptionPlanSchema, UpdateSubscriptionPlanSchema } from '../dto/subscription-plans.dto';

@ApiTags('subscription-plans')
@Controller('subscription-plans')
export class SubscriptionPlansController {
  constructor(private readonly svc: SubscriptionPlansService) {}

  @Get('layout/list') @RequirePermission('subscription-plans.read')
  getListLayout() { return this.svc.getListLayout(); }

  @Get() @RequirePermission('subscription-plans.read')
  list(@Query() q: Record<string, unknown>, @AccessContext() c?: DataAccessContext) {
    return this.svc.list({ ...q, page: q.page ? Number(q.page) : undefined, limit: q.limit ? Number(q.limit) : undefined, includeDeleted: q.includeDeleted === 'true' }, c);
  }

  @Get(':id') @RequirePermission('subscription-plans.read')
  findOne(@Param('id', ParseUUIDPipe) id: string, @AccessContext() c?: DataAccessContext) { return this.svc.findOne(id, c); }

  @Post() @RequirePermission('subscription-plans.create') @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown, @CurrentUser() u: JwtPayload) { return this.svc.create(CreateSubscriptionPlanSchema.parse(body), u.userId); }

  @Patch(':id') @RequirePermission('subscription-plans.update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown, @CurrentUser() u: JwtPayload, @AccessContext() c?: DataAccessContext) {
    return this.svc.update(id, UpdateSubscriptionPlanSchema.parse(body), u.userId, c);
  }

  @Delete(':id') @RequirePermission('subscription-plans.delete') @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: JwtPayload, @AccessContext() c?: DataAccessContext) {
    await this.svc.softDelete(id, u.userId, c);
  }

  @Post(':id/clone') @RequirePermission('subscription-plans.create') @HttpCode(HttpStatus.CREATED)
  clone(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: JwtPayload) { return this.svc.clone(id, u.userId); }

  @Post(':id/restore') @RequirePermission('subscription-plans.update')
  restore(@Param('id', ParseUUIDPipe) id: string) { return this.svc.restore(id); }
}
