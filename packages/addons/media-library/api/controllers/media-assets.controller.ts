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
import { MediaAssetsService } from '../services/media-assets.service';
import { CreateMediaAssetSchema, UpdateMediaAssetSchema } from '../dto/media-assets.dto';

@ApiTags('media-assets')
@Controller('media-assets')
export class MediaAssetsController {
  constructor(private readonly assets: MediaAssetsService) {}

  @Get('layout/list')
  @RequirePermission('media-assets.read')
  @ApiOperation({ summary: 'Get list layout config for media assets' })
  getListLayout() {
    return this.assets.getListLayout();
  }

  @Get()
  @RequirePermission('media-assets.read')
  @ApiOperation({ summary: 'List media assets' })
  list(@Query() query: Record<string, unknown>, @AccessContext() accessCtx?: DataAccessContext) {
    const parsed = {
      ...query,
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      includeDeleted: query.includeDeleted === 'true',
    };
    return this.assets.list(parsed, accessCtx);
  }

  @Get(':id')
  @RequirePermission('media-assets.read')
  @ApiOperation({ summary: 'Get a single media asset by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @AccessContext() accessCtx?: DataAccessContext) {
    return this.assets.findOne(id, accessCtx);
  }

  @Post()
  @RequirePermission('media-assets.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a media asset row' })
  create(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = CreateMediaAssetSchema.parse(body);
    return this.assets.create(input, user.userId);
  }

  @Patch(':id')
  @RequirePermission('media-assets.update')
  @ApiOperation({ summary: 'Update a media asset' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const input = UpdateMediaAssetSchema.parse(body);
    return this.assets.update(id, input, user.userId, accessCtx);
  }

  @Delete(':id')
  @RequirePermission('media-assets.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a media asset' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    await this.assets.softDelete(id, user.userId, accessCtx);
  }

  @Post(':id/clone')
  @RequirePermission('media-assets.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Clone a media asset' })
  clone(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.assets.clone(id, user.userId);
  }

  @Post(':id/restore')
  @RequirePermission('media-assets.update')
  @ApiOperation({ summary: 'Restore a soft-deleted media asset' })
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.assets.restore(id);
  }
}
