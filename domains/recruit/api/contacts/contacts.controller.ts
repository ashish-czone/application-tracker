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
import { ContactsService } from './contacts.service';
import { CreateContactSchema, UpdateContactSchema } from './contacts.dto';

@ApiTags('contacts')
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get('layout/list')
  @RequirePermission('contacts.read')
  @ApiOperation({ summary: 'Get list layout config for contacts' })
  getListLayout() {
    return this.contacts.getListLayout();
  }

  @Get()
  @RequirePermission('contacts.read')
  @ApiOperation({ summary: 'List contacts' })
  list(@Query() query: Record<string, unknown>, @AccessContext() accessCtx?: DataAccessContext) {
    const parsed = {
      ...query,
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      includeDeleted: query.includeDeleted === 'true',
    };
    return this.contacts.list(parsed, accessCtx);
  }

  @Get(':id')
  @RequirePermission('contacts.read')
  @ApiOperation({ summary: 'Get a single contact by ID' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    return this.contacts.findOne(id, accessCtx);
  }

  @Post()
  @RequirePermission('contacts.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new contact' })
  create(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = CreateContactSchema.parse(body);
    return this.contacts.create(input, user.userId);
  }

  @Patch(':id')
  @RequirePermission('contacts.update')
  @ApiOperation({ summary: 'Update a contact' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const input = UpdateContactSchema.parse(body);
    return this.contacts.update(id, input, user.userId, accessCtx);
  }

  @Delete(':id')
  @RequirePermission('contacts.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a contact' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    await this.contacts.softDelete(id, user.userId, accessCtx);
  }

  @Post(':id/clone')
  @RequirePermission('contacts.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Clone a contact' })
  clone(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.contacts.clone(id, user.userId);
  }

  @Post(':id/restore')
  @RequirePermission('contacts.update')
  @ApiOperation({ summary: 'Restore a soft-deleted contact' })
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.contacts.restore(id);
  }
}
