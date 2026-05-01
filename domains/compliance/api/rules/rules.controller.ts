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
import { ComplianceRulesService } from './rules.service';
import {
  CreateComplianceRuleSchema,
  DeprecateComplianceRuleSchema,
  RulesListQuerySchema,
  TransitionComplianceRuleSchema,
  UpdateComplianceRuleSchema,
} from './rules.dto';

@Controller('compliance-rules')
export class ComplianceRulesController {
  constructor(private readonly rules: ComplianceRulesService) {}

  @Get('layout/list')
  @RequirePermission('compliance-rules.read')
  getListLayout() {
    return this.rules.getListLayout();
  }

  @Get()
  @RequirePermission('compliance-rules.read')
  list(
    @Query() query: Record<string, unknown>,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    return this.rules.list(RulesListQuerySchema.parse(query), accessCtx);
  }

  @Get('summary')
  @RequirePermission('compliance-rules.read')
  summary(@AccessContext() accessCtx?: DataAccessContext) {
    return this.rules.getSummary(accessCtx);
  }

  /**
   * Preview what would happen if the rule were deprecated right now. Feeds
   * the deprecation dialog (I10) — returns the count of non-terminal filings
   * for this rule across all clients. The UI hides the `alsoCancelInFlight`
   * checkbox when the count is zero. Permission mirrors the deprecate
   * endpoint so preview counts don't leak to users who can't actually act.
   */
  @Get(':id/deprecation-preview')
  @RequirePermission('compliance-rules.update')
  previewDeprecation(
    @Param('id', ParseUUIDPipe) id: string,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    return this.rules.previewDeprecation(id, accessCtx);
  }

  /**
   * I15: return the edit constraints the rule form needs to render.
   * `hasGeneratedFilings` drives the disabled state on `code`/`frequency`/`lawId`;
   * `generatedFilingCount` is shown in the forward-only save dialog when
   * due-date-math fields are touched. Permission mirrors the update endpoint
   * since a user who can't update shouldn't be computing edit constraints.
   */
  @Get(':id/edit-constraints')
  @RequirePermission('compliance-rules.update')
  getEditConstraints(
    @Param('id', ParseUUIDPipe) id: string,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    return this.rules.getEditConstraints(id, accessCtx);
  }

  @Get(':id')
  @RequirePermission('compliance-rules.read')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    return this.rules.findOne(id, accessCtx);
  }

  @Post()
  @RequirePermission('compliance-rules.create')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = CreateComplianceRuleSchema.parse(body);
    return this.rules.create(input, user.userId);
  }

  @Patch(':id')
  @RequirePermission('compliance-rules.update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const input = UpdateComplianceRuleSchema.parse(body);
    return this.rules.update(id, input, user.userId, accessCtx);
  }

  @Delete(':id')
  @RequirePermission('compliance-rules.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    await this.rules.softDelete(id, user.userId, accessCtx);
  }

  @Post(':id/clone')
  @RequirePermission('compliance-rules.create')
  @HttpCode(HttpStatus.CREATED)
  clone(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.rules.clone(id, user.userId);
  }

  @Post(':id/restore')
  @RequirePermission('compliance-rules.update')
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.rules.restore(id);
  }

  @Post(':id/transition')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('compliance-rules.update')
  transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const input = TransitionComplianceRuleSchema.parse(body);
    return this.rules.transition(
      id,
      input.fieldKey,
      input.to,
      user.userId,
      { reason: input.reason, comment: input.comment },
      accessCtx,
    );
  }

  @Post(':id/deprecate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('compliance-rules.deprecate')
  deprecate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const dto = DeprecateComplianceRuleSchema.parse(body);
    return this.rules.deprecate(
      id,
      {
        alsoCancelInFlight: dto.alsoCancelInFlight,
        actorId: user.userId,
        comment: dto.comment,
      },
      accessCtx,
    );
  }
}
