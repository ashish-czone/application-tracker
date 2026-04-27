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
import {
  AccessContext,
  RequirePermission,
  type DataAccessContext,
} from '@packages/rbac';
import { CurrentUser, type JwtPayload } from '@packages/auth-core';
import { FeaturesService } from './features.service';
import {
  CreateFeatureSchema,
  TransitionFeatureSchema,
  UpdateFeatureSchema,
} from './features.dto';

@Controller('features')
export class FeaturesController {
  constructor(private readonly features: FeaturesService) {}

  @Get('layout/list')
  @RequirePermission('features.read')
  getListLayout() {
    return this.features.getListLayout();
  }

  @Get()
  @RequirePermission('features.read')
  list(@Query() query: Record<string, unknown>, @AccessContext() accessCtx?: DataAccessContext) {
    const parsed = {
      ...query,
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      includeDeleted: query.includeDeleted === 'true',
    };
    return this.features.list(parsed, accessCtx);
  }

  @Get(':id')
  @RequirePermission('features.read')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    return this.features.findOne(id, accessCtx);
  }

  @Post()
  @RequirePermission('features.create')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = CreateFeatureSchema.parse(body);
    return this.features.create(input, user.userId);
  }

  @Patch(':id')
  @RequirePermission('features.update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const input = UpdateFeatureSchema.parse(body);
    return this.features.update(id, input, user.userId, accessCtx);
  }

  @Delete(':id')
  @RequirePermission('features.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    await this.features.softDelete(id, user.userId, accessCtx);
  }

  @Post(':id/restore')
  @RequirePermission('features.update')
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.features.restore(id);
  }

  @Post(':id/transition')
  @RequirePermission('features.update')
  @HttpCode(HttpStatus.CREATED)
  transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const input = TransitionFeatureSchema.parse(body);
    return this.features.transition(
      id,
      input.fieldKey,
      input.to,
      user.userId,
      { reason: input.reason, comment: input.comment },
      accessCtx,
    );
  }
}
