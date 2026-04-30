import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RequirePermission } from '@packages/rbac';
import { CurrentUser, type JwtPayload } from '@packages/auth-core';
import { ClientContactsService } from '../services/client-contacts.service';
import { DIRECTORY_PERMISSIONS } from '../permissions';
import { MergeRequestSchema } from '../dto/merge.dto';

@ApiTags('directory')
@Controller('admin/directory/client-contacts')
export class ClientContactsController {
  constructor(private readonly clientContacts: ClientContactsService) {}

  @Post('merge')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(DIRECTORY_PERMISSIONS.MERGE)
  @ApiOperation({ summary: 'Merge two client contacts; loser gets soft-deleted and redirected' })
  async merge(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const { loserId, winnerId } = MergeRequestSchema.parse(body);
    return this.clientContacts.merge(loserId, winnerId, user.userId);
  }
}
