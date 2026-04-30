import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RequirePermission } from '@packages/rbac';
import { CurrentUser, type JwtPayload } from '@packages/auth-core';
import { ClientsService } from '../services/clients.service';
import { DIRECTORY_PERMISSIONS } from '../permissions';
import { MergeRequestSchema } from '../dto/merge.dto';

@ApiTags('directory')
@Controller('admin/directory/clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get('search')
  @RequirePermission(DIRECTORY_PERMISSIONS.READ)
  @ApiOperation({ summary: 'Search clients by name (autocomplete picker)' })
  async search(@Query('q') q: string = '', @Query('limit') limit?: string) {
    const parsed = limit ? Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100) : 20;
    return this.clients.searchByName(q, parsed);
  }

  @Post('merge')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(DIRECTORY_PERMISSIONS.MERGE)
  @ApiOperation({ summary: 'Merge two clients; loser gets soft-deleted and redirected' })
  async merge(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const { loserId, winnerId } = MergeRequestSchema.parse(body);
    return this.clients.merge(loserId, winnerId, user.userId);
  }
}
