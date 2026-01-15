import { Global, Module } from '@nestjs/common';
import { SettingsService, SETTING_KEYS } from './settings.service';
import { SettingsController } from './settings.controller';

@Global()
@Module({
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}

export { SettingsService, SETTING_KEYS };
