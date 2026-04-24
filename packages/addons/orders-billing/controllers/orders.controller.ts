import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, type JwtPayload } from '@packages/auth';
import { AccessContext, RequirePermission, type DataAccessContext } from '@packages/rbac';
import { OrdersService } from '../services/orders.service';
import { CreateOrderSchema, UpdateOrderSchema } from '../dto/orders.dto';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly svc: OrdersService) {}

  @Get('layout/list') @RequirePermission('orders.read')
  getListLayout() { return this.svc.getListLayout(); }

  @Get() @RequirePermission('orders.read')
  list(@Query() q: Record<string, unknown>, @AccessContext() c?: DataAccessContext) {
    return this.svc.list({ ...q, page: q.page ? Number(q.page) : undefined, limit: q.limit ? Number(q.limit) : undefined, includeDeleted: q.includeDeleted === 'true' }, c);
  }

  @Get(':id') @RequirePermission('orders.read')
  findOne(@Param('id', ParseUUIDPipe) id: string, @AccessContext() c?: DataAccessContext) { return this.svc.findOne(id, c); }

  @Post() @RequirePermission('orders.create') @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown, @CurrentUser() u: JwtPayload) { return this.svc.create(CreateOrderSchema.parse(body), u.userId); }

  @Patch(':id') @RequirePermission('orders.update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown, @CurrentUser() u: JwtPayload, @AccessContext() c?: DataAccessContext) {
    return this.svc.update(id, UpdateOrderSchema.parse(body), u.userId, c);
  }

  @Delete(':id') @RequirePermission('orders.delete') @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: JwtPayload, @AccessContext() c?: DataAccessContext) {
    await this.svc.softDelete(id, u.userId, c);
  }

  @Post(':id/clone') @RequirePermission('orders.create') @HttpCode(HttpStatus.CREATED)
  clone(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: JwtPayload) { return this.svc.clone(id, u.userId); }

  @Post(':id/restore') @RequirePermission('orders.update')
  restore(@Param('id', ParseUUIDPipe) id: string) { return this.svc.restore(id); }
}
