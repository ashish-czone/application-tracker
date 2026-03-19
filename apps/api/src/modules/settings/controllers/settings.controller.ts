import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser, type JwtPayload } from '@packages/auth';
import { RequirePermission } from '@packages/rbac';
import { AppConfigService } from '@packages/settings';
import { UpdateSettingDto } from '../dto/update-setting.dto';
import { SETTINGS_PERMISSIONS } from '../permissions';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly appConfig: AppConfigService) {}

  @Get()
  @RequirePermission(SETTINGS_PERMISSIONS.READ)
  @ApiOperation({ summary: 'List all settings across all modules' })
  async list() {
    return this.appConfig.getAll();
  }

  @Get(':module')
  @RequirePermission(SETTINGS_PERMISSIONS.READ)
  @ApiOperation({ summary: 'Get settings for a specific module' })
  async getByModule(@Param('module') module: string) {
    return this.appConfig.getByModule(module);
  }

  @Patch(':module/:key')
  @RequirePermission(SETTINGS_PERMISSIONS.MANAGE)
  @ApiOperation({ summary: 'Update a single setting' })
  async update(
    @Param('module') module: string,
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.appConfig.set(module, key, dto.value, user.userId);
    return this.appConfig.getByModule(module);
  }

  @Delete(':module/:key')
  @RequirePermission(SETTINGS_PERMISSIONS.MANAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset a setting to its default value' })
  async reset(
    @Param('module') module: string,
    @Param('key') key: string,
  ) {
    await this.appConfig.reset(module, key);
    return this.appConfig.getByModule(module);
  }
}
