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
import { ClientsService } from './clients.service';
import { CreateClientSchema, UpdateClientSchema } from './clients.dto';

@ApiTags('clients')
@Controller('clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  @RequirePermission('clients.read')
  @ApiOperation({ summary: 'List clients' })
  list(@Query() query: Record<string, unknown>, @AccessContext() accessCtx?: DataAccessContext) {
    const parsed = {
      ...query,
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      includeDeleted: query.includeDeleted === 'true',
    };
    return this.clients.list(parsed, accessCtx);
  }

  @Get(':id')
  @RequirePermission('clients.read')
  @ApiOperation({ summary: 'Get a single client by ID' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    return this.clients.findOne(id, accessCtx);
  }

  @Post()
  @RequirePermission('clients.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new client' })
  create(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = CreateClientSchema.parse(body);
    return this.clients.create(input, user.userId);
  }

  @Patch(':id')
  @RequirePermission('clients.update')
  @ApiOperation({ summary: 'Update a client' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const input = UpdateClientSchema.parse(body);
    return this.clients.update(id, input, user.userId, accessCtx);
  }

  @Delete(':id')
  @RequirePermission('clients.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a client' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    await this.clients.softDelete(id, user.userId, accessCtx);
  }

  @Post(':id/clone')
  @RequirePermission('clients.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Clone a client' })
  clone(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.clients.clone(id, user.userId);
  }

  @Post(':id/restore')
  @RequirePermission('clients.update')
  @ApiOperation({ summary: 'Restore a soft-deleted client' })
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.clients.restore(id);
  }
}
