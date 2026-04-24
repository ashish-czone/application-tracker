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
import { CurrentUser, type JwtPayload } from '@packages/auth';
import {
  AccessContext,
  RequirePermission,
  type DataAccessContext,
} from '@packages/rbac';
import { LawsService } from './laws.service';
import { CreateLawSchema, UpdateLawSchema } from './laws.dto';

@Controller('laws')
export class LawsController {
  constructor(private readonly laws: LawsService) {}

  @Get('layout/list')
  @RequirePermission('laws.read')
  getListLayout() {
    return this.laws.getListLayout();
  }

  @Get()
  @RequirePermission('laws.read')
  list(@Query() query: Record<string, unknown>, @AccessContext() accessCtx?: DataAccessContext) {
    const parsed = {
      ...query,
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      includeDeleted: query.includeDeleted === 'true',
    };
    return this.laws.list(parsed, accessCtx);
  }

  @Get(':id')
  @RequirePermission('laws.read')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    return this.laws.findOne(id, accessCtx);
  }

  @Post()
  @RequirePermission('laws.create')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = CreateLawSchema.parse(body);
    return this.laws.create(input, user.userId);
  }

  @Patch(':id')
  @RequirePermission('laws.update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const input = UpdateLawSchema.parse(body);
    return this.laws.update(id, input, user.userId, accessCtx);
  }

  @Delete(':id')
  @RequirePermission('laws.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    await this.laws.softDelete(id, user.userId, accessCtx);
  }

  @Post(':id/clone')
  @RequirePermission('laws.create')
  @HttpCode(HttpStatus.CREATED)
  clone(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.laws.clone(id, user.userId);
  }

  @Post(':id/restore')
  @RequirePermission('laws.update')
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.laws.restore(id);
  }
}
