import {
  Controller,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RequirePermission } from '@packages/rbac';
import { UsersService } from '../services/users.service';
import { ResetPasswordDto } from '../dto/reset-password.dto';

/**
 * Thin users controller. CRUD + soft-delete + restore + list come from the
 * generic entity-engine controller auto-mounted by `forEntity(usersConfig)`.
 *
 * This controller only hosts endpoints the engine does not generate — today
 * just the admin-only password reset action. It coexists at `@Controller('users')`
 * with the auto-generated controller because NestJS matches on the (method, path)
 * tuple and `POST /users/:id/reset-password` is more specific than any
 * auto-generated route.
 */
@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post(':id/reset-password')
  @RequirePermission('users.update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Reset a user's password (admin action)" })
  async resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
  ) {
    await this.usersService.resetPassword(id, dto.password);
  }
}
