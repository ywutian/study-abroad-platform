import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { CronRegistryService } from './cron-registry.service';
import { CronSecretGuard } from './cron-secret.guard';
import { InternalCronController } from './internal-cron.controller';

/**
 * The HTTP cron driver: discovery registry + `/internal/cron` dispatcher.
 * See schedule-driver.ts for the driver model (timer vs http).
 */
@Module({
  imports: [DiscoveryModule],
  controllers: [InternalCronController],
  providers: [CronRegistryService, CronSecretGuard],
  exports: [CronRegistryService],
})
export class CronModule {}
