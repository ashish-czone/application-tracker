import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { RequirePermission } from '@packages/rbac-nestjs';
import { Public, CurrentIdentity, setRefreshCookie } from '@packages/auth-nestjs';
import type { AuthenticableIdentity } from '@packages/auth';
import { UsersService } from '../services/users.service';
import { USERS_PERMISSIONS } from '../permissions';
import { RegisterUserDto } from '../dto/register-user.dto';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { ListUsersQueryDto } from '../dto/list-users-query.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken, refreshToken } = await this.usersService.create(dto, null);
    setRefreshCookie(res, 'user', refreshToken);
    return { user, accessToken };
  }

  @Post()
  @RequirePermission(USERS_PERMISSIONS.CREATE)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateUserDto,
    @CurrentIdentity() identity: AuthenticableIdentity,
  ) {
    const { user } = await this.usersService.create(dto, identity.id);
    return user;
  }

  @Get()
  @RequirePermission(USERS_PERMISSIONS.READ)
  async findAll(@Query() query: ListUsersQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @RequirePermission(USERS_PERMISSIONS.READ)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOneOrFail(id);
  }

  @Patch(':id')
  @RequirePermission(USERS_PERMISSIONS.UPDATE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentIdentity() identity: AuthenticableIdentity,
  ) {
    return this.usersService.update(id, dto, identity.id);
  }

  @Delete(':id')
  @RequirePermission(USERS_PERMISSIONS.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentIdentity() identity: AuthenticableIdentity,
  ) {
    await this.usersService.softDelete(id, identity.id);
  }
}
