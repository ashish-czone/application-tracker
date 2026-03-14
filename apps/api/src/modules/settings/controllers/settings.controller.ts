import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SettingsService } from '@packages/settings';
import { RequirePermission } from '@packages/rbac-nestjs';
import { CurrentIdentity } from '@packages/auth-nestjs';
import { SETTINGS_PERMISSIONS } from '../permissions';
import { UpdateModuleSettingsDto } from '../dto/update-module-settings.dto';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @RequirePermission(SETTINGS_PERMISSIONS.READ)
  @ApiOperation({ summary: 'List all module settings' })
  async findAll() {
    return this.settingsService.getAllModuleSettings();
  }

  @Get(':module')
  @RequirePermission(SETTINGS_PERMISSIONS.READ)
  @ApiOperation({ summary: 'Get settings for a specific module' })
  async findByModule(@Param('module') module: string) {
    return this.settingsService.getModuleSettings(module);
  }

  @Patch(':module')
  @RequirePermission(SETTINGS_PERMISSIONS.MANAGE)
  @ApiOperation({ summary: 'Update settings for a module' })
  async update(
    @Param('module') module: string,
    @Body() dto: UpdateModuleSettingsDto,
    @CurrentIdentity() identity: { id: string },
  ) {
    return this.settingsService.upsertSettings(module, dto.settings, identity.id);
  }

  @Delete(':module/:key')
  @RequirePermission(SETTINGS_PERMISSIONS.MANAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset a setting to its default value' })
  async reset(
    @Param('module') module: string,
    @Param('key') key: string,
  ) {
    return this.settingsService.resetSetting(module, key);
  }
}
