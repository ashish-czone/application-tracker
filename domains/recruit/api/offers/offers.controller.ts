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
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type JwtPayload } from '@packages/auth';
import {
  AccessContext,
  RequirePermission,
  type DataAccessContext,
} from '@packages/rbac';
import { OffersService } from './offers.service';
import { CreateOfferSchema, UpdateOfferSchema } from './offers.dto';

/**
 * Baseline CRUD controller for offers. Approval-workflow routes
 * (:id/approvals, :id/send-letter) live on OfferApprovalsController.
 */
@ApiTags('offers')
@Controller('offers')
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  @Get('layout/list')
  @RequirePermission('offers.read')
  @ApiOperation({ summary: 'Get list layout config for offers' })
  getListLayout() {
    return this.offers.getListLayout();
  }

  @Get()
  @RequirePermission('offers.read')
  @ApiOperation({ summary: 'List offers' })
  list(@Query() query: Record<string, unknown>, @AccessContext() accessCtx?: DataAccessContext) {
    const parsed = {
      ...query,
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      includeDeleted: query.includeDeleted === 'true',
    };
    return this.offers.list(parsed, accessCtx);
  }

  @Get(':id')
  @RequirePermission('offers.read')
  @ApiOperation({ summary: 'Get a single offer by ID' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    return this.offers.findOne(id, accessCtx);
  }

  @Post()
  @RequirePermission('offers.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new offer' })
  create(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = CreateOfferSchema.parse(body);
    return this.offers.create(input, user.userId);
  }

  @Patch(':id')
  @RequirePermission('offers.update')
  @ApiOperation({ summary: 'Update an offer' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const input = UpdateOfferSchema.parse(body);
    return this.offers.update(id, input, user.userId, accessCtx);
  }

  @Delete(':id')
  @RequirePermission('offers.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete an offer' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    await this.offers.softDelete(id, user.userId, accessCtx);
  }

  @Post(':id/clone')
  @RequirePermission('offers.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Clone an offer' })
  clone(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.offers.clone(id, user.userId);
  }

  @Post(':id/restore')
  @RequirePermission('offers.update')
  @ApiOperation({ summary: 'Restore a soft-deleted offer' })
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.offers.restore(id);
  }
}
