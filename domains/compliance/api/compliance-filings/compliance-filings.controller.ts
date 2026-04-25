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
import { ComplianceFilingsService } from './compliance-filings.service';
import {
  CreateComplianceFilingSchema,
  TransitionComplianceFilingSchema,
  UpdateComplianceFilingSchema,
} from './compliance-filings.dto';

@Controller('compliance-filings')
export class ComplianceFilingsController {
  constructor(private readonly filings: ComplianceFilingsService) {}

  @Get('layout/list')
  @RequirePermission('compliance-filings.read')
  getListLayout() {
    return this.filings.getListLayout();
  }

  @Get()
  @RequirePermission('compliance-filings.read')
  list(@Query() query: Record<string, unknown>, @AccessContext() accessCtx?: DataAccessContext) {
    const parsed = {
      ...query,
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      includeDeleted: query.includeDeleted === 'true',
    };
    return this.filings.list(parsed, accessCtx);
  }

  @Get(':id')
  @RequirePermission('compliance-filings.read')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    return this.filings.findOne(id, accessCtx);
  }

  @Post()
  @RequirePermission('compliance-filings.create')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = CreateComplianceFilingSchema.parse(body);
    return this.filings.create(input, user.userId);
  }

  @Patch(':id')
  @RequirePermission('compliance-filings.update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const input = UpdateComplianceFilingSchema.parse(body);
    return this.filings.update(id, input, user.userId, accessCtx);
  }

  @Delete(':id')
  @RequirePermission('compliance-filings.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    await this.filings.softDelete(id, user.userId, accessCtx);
  }

  @Post(':id/clone')
  @RequirePermission('compliance-filings.create')
  @HttpCode(HttpStatus.CREATED)
  clone(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.filings.clone(id, user.userId);
  }

  @Post(':id/restore')
  @RequirePermission('compliance-filings.update')
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.filings.restore(id);
  }

  @Post(':id/transition')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('compliance-filings.update')
  transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const input = TransitionComplianceFilingSchema.parse(body);
    return this.filings.transition(
      id,
      input.fieldKey,
      input.to,
      user.userId,
      { reason: input.reason, comment: input.comment },
      accessCtx,
    );
  }
}
