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
import { todayInTimezone } from '@packages/common';
import {
  AccessContext,
  RequirePermission,
  type DataAccessContext,
} from '@packages/rbac';
import { ComplianceFilingsService } from './compliance-filings.service';
import { buildBaseListQuery } from './compliance-filings.filters';
import {
  CreateComplianceFilingSchema,
  FilingsListQuerySchema,
  TransitionComplianceFilingSchema,
  UpdateComplianceFilingSchema,
} from './compliance-filings.dto';

@Controller('compliance-filings')
export class ComplianceFilingsController {
  constructor(private readonly filings: ComplianceFilingsService) {}

  @Get('summary')
  @RequirePermission('compliance-filings.read')
  getSummary(
    @Query('today') todayParam: string | undefined,
    @Query('clientId') clientId: string | undefined,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const tz = process.env.APP_TIMEZONE ?? 'UTC';
    const today = todayParam && /^\d{4}-\d{2}-\d{2}$/.test(todayParam) ? todayParam : todayInTimezone(tz);
    return this.filings.getSummary(today, { clientId: clientId || undefined }, accessCtx);
  }

  @Get()
  @RequirePermission('compliance-filings.read')
  list(@Query() query: Record<string, unknown>, @AccessContext() accessCtx?: DataAccessContext) {
    const tz = process.env.APP_TIMEZONE ?? 'UTC';
    const today =
      typeof query.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.today)
        ? query.today
        : todayInTimezone(tz);
    const parsed = FilingsListQuerySchema.parse(query);
    return this.filings.list(buildBaseListQuery(parsed, today), accessCtx);
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
