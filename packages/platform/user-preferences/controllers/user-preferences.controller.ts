import { Controller, Get, Put, Delete, Body, Param, Query, HttpCode, HttpStatus, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RequirePermission } from '@packages/rbac';
import { CurrentUser, type JwtPayload } from '@packages/auth-core';
import { USER_PREFERENCES_PERMISSIONS } from '../permissions';
import { UserPreferencesService } from '../services/user-preferences.service';
import { SetPreferenceDto } from '../dto/set-preference.dto';
import { ListPreferencesQueryDto } from '../dto/list-preferences-query.dto';

@ApiTags('user-preferences')
@Controller('me/preferences')
export class UserPreferencesController {
  constructor(private readonly service: UserPreferencesService) {}

  @Get()
  @RequirePermission(USER_PREFERENCES_PERMISSIONS.READ)
  @ApiOperation({ summary: 'List the current user\'s preferences' })
  list(@CurrentUser() user: JwtPayload, @Query() query: ListPreferencesQueryDto) {
    return this.service.listForUser(user.userId, query.namespace);
  }

  @Get(':namespace/:key')
  @RequirePermission(USER_PREFERENCES_PERMISSIONS.READ)
  @ApiOperation({ summary: 'Get a single preference for the current user' })
  async getOne(
    @CurrentUser() user: JwtPayload,
    @Param('namespace') namespace: string,
    @Param('key') key: string,
  ) {
    const pref = await this.service.getOne(user.userId, namespace, key);
    if (!pref) {
      throw new NotFoundException(`Preference ${namespace}/${key} not found`);
    }
    return pref;
  }

  @Put(':namespace/:key')
  @RequirePermission(USER_PREFERENCES_PERMISSIONS.WRITE)
  @ApiOperation({ summary: 'Set a preference for the current user (upsert)' })
  set(
    @CurrentUser() user: JwtPayload,
    @Param('namespace') namespace: string,
    @Param('key') key: string,
    @Body() dto: SetPreferenceDto,
  ) {
    return this.service.set(user.userId, namespace, key, dto.value);
  }

  @Delete(':namespace/:key')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(USER_PREFERENCES_PERMISSIONS.WRITE)
  @ApiOperation({ summary: 'Delete a preference for the current user' })
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param('namespace') namespace: string,
    @Param('key') key: string,
  ) {
    await this.service.delete(user.userId, namespace, key);
  }
}
