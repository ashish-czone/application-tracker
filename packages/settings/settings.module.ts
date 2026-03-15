import { Global, Module } from '@nestjs/common';
import { AppConfigService } from './services/app-config.service';
import { SettingsStoreService } from './services/settings-store.service';

@Global()
@Module({
  providers: [SettingsStoreService, AppConfigService],
  exports: [AppConfigService],
})
export class SettingsModule {}
