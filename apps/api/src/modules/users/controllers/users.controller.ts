import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser, type JwtPayload } from '@packages/auth';
import { RequirePermission } from '@packages/rbac';
import { UsersService } from '../services/users.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { ListUsersQueryDto } from '../dto/list-users-query.dto';
import { USERS_PERMISSIONS } from '../permissions';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermission(USERS_PERMISSIONS.READ)
  @ApiOperation({ summary: 'List users with pagination, search, and filtering' })
  async list(@Query() query: ListUsersQueryDto) {
    const { includeDeleted, ...rest } = query;
    return this.usersService.list({
      ...rest,
      includeDeleted: includeDeleted === 'true',
    });
  }

  @Get(':id')
  @RequirePermission(USERS_PERMISSIONS.READ)
  @ApiOperation({ summary: 'Get a single user by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOneOrFail(id);
  }

  @Post()
  @RequirePermission(USERS_PERMISSIONS.CREATE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new user' })
  async create(@Body() dto: CreateUserDto, @CurrentUser() user: JwtPayload) {
    return this.usersService.create(dto, user.userId);
  }

  @Patch(':id')
  @RequirePermission(USERS_PERMISSIONS.UPDATE)
  @ApiOperation({ summary: 'Update an existing user' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.usersService.update(id, dto, user.userId);
  }

  @Delete(':id')
  @RequirePermission(USERS_PERMISSIONS.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a user' })
  async delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    await this.usersService.softDelete(id, user.userId);
  }

  @Patch(':id/restore')
  @RequirePermission(USERS_PERMISSIONS.UPDATE)
  @ApiOperation({ summary: 'Restore a soft-deleted user' })
  async restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.restore(id);
  }
}
