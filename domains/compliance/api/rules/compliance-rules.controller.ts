import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { RequirePermission } from '@packages/rbac';
import { CurrentUser, type JwtPayload } from '@packages/auth';
import { ComplianceRuleService } from './compliance-rules.service';
import { DeprecateRuleDto } from './dto/deprecate-rule.dto';
import { UpdateComplianceRuleDto } from './dto/update-rule.dto';

/**
 * Rule-level lifecycle endpoints that layer on top of the generic
 * entity-engine controller auto-registered for `compliance_rules`. The
 * preview + deprecate cascade (I8-I10) cannot be expressed through the
 * generic workflow-transition endpoint because it carries a domain-specific
 * opt-in flag (`alsoCancelInFlight`) and needs atomic fan-out to filings.
 *
 * URL slug intentionally mirrors the entity slug (`compliance-rules`) with
 * hyphens; generic CRUD lives at `/compliance_rules` underscore-path via
 * the entity engine.
 */
@Controller('compliance-rules')
export class ComplianceRulesController {
  constructor(private readonly rules: ComplianceRuleService) {}

  /**
   * Preview what would happen if the rule were deprecated right now. Feeds
   * the deprecation dialog (I10) — returns the count of non-terminal filings
   * for this rule across all clients. The UI hides the `alsoCancelInFlight`
   * checkbox when the count is zero. Permission mirrors the deprecate
   * endpoint so preview counts don't leak to users who can't actually act.
   */
  @Get(':id/deprecation-preview')
  @RequirePermission('compliance_rules.update')
  async previewDeprecation(@Param('id', ParseUUIDPipe) id: string) {
    return this.rules.previewDeprecation(id);
  }

  /**
   * I15: return the edit constraints the rule form needs to render.
   * `hasGeneratedFilings` drives the disabled state on `code`/`frequency`/`lawId`;
   * `generatedFilingCount` is shown in the forward-only save dialog when
   * due-date-math fields are touched. Permission mirrors the update endpoint
   * since a user who can't update shouldn't be computing edit constraints.
   */
  @Get(':id/edit-constraints')
  @RequirePermission('compliance_rules.update')
  async getEditConstraints(@Param('id', ParseUUIDPipe) id: string) {
    return this.rules.getEditConstraints(id);
  }

  @Post(':id/deprecate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('compliance_rules.update')
  async deprecate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeprecateRuleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.rules.deprecate(id, {
      alsoCancelInFlight: dto.alsoCancelInFlight,
      actorId: user.userId,
      comment: dto.comment,
    });
  }

  /**
   * Domain PATCH route used by the custom rule edit form. Runs the I14
   * identity-field guard in the service and returns the updated rule.
   * Mirrors the generic `/compliance_rules/:id` controller path but keeps
   * the rule-specific surface (preview / deprecate / constraints / update)
   * on one URL root so the UI invalidates a single query family.
   *
   * The same guard is also wired as `beforeUpdate` on the entity config so
   * callers hitting the generic route still get blocked — this endpoint is
   * a convenience, not the sole enforcement point.
   */
  @Patch(':id')
  @RequirePermission('compliance_rules.update')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateComplianceRuleDto,
  ) {
    return this.rules.update(id, dto);
  }
}
