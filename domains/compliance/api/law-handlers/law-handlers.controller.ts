import {
  Body,
  Controller,
  Delete,
  forwardRef,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
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
import { LawHandlersService } from './law-handlers.service';
import { ComplianceRulesService } from '../rules';
import { CreateLawHandlerSchema, UpdateLawHandlerSchema } from './law-handlers.dto';

@Controller('law-handlers')
export class LawHandlersController {
  constructor(
    private readonly lawHandlers: LawHandlersService,
    @Inject(forwardRef(() => ComplianceRulesService))
    private readonly rules: ComplianceRulesService,
  ) {}

  @Get('layout/list')
  @RequirePermission('law-handlers.read')
  getListLayout() {
    return this.lawHandlers.getListLayout();
  }

  @Get()
  @RequirePermission('law-handlers.read')
  list(@Query() query: Record<string, unknown>, @AccessContext() accessCtx?: DataAccessContext) {
    const parsed = {
      ...query,
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      includeDeleted: query.includeDeleted === 'true',
    };
    return this.lawHandlers.list(parsed, accessCtx);
  }

  @Get(':id')
  @RequirePermission('law-handlers.read')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    return this.lawHandlers.findOne(id, accessCtx);
  }

  @Post()
  @RequirePermission('law-handlers.create')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = CreateLawHandlerSchema.parse(body);
    return this.lawHandlers.create(input, user.userId);
  }

  @Patch(':id')
  @RequirePermission('law-handlers.update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const input = UpdateLawHandlerSchema.parse(body);
    return this.lawHandlers.update(id, input, user.userId, accessCtx);
  }

  @Delete(':id')
  @RequirePermission('law-handlers.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    // I21: prevent removal that would orphan active registrations.
    await this.rules.assertHandlerCanBeDeleted(id);
    await this.lawHandlers.softDelete(id, user.userId, accessCtx);
  }

  @Post(':id/clone')
  @RequirePermission('law-handlers.create')
  @HttpCode(HttpStatus.CREATED)
  clone(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.lawHandlers.clone(id, user.userId);
  }

  @Post(':id/restore')
  @RequirePermission('law-handlers.update')
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.lawHandlers.restore(id);
  }
}
