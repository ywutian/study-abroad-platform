import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { ClosureSchedulerService } from './closure-scheduler.service';

/**
 * closure-v2 Continuous Closure Engine module.
 *
 * Hosts the Tier-1 non-pausing scheduler. The tick loop only runs when
 * CLOSURE_ENGINE_ENABLED=true, so importing this module is safe by default.
 */
@Module({
  imports: [PrismaModule],
  providers: [ClosureSchedulerService],
  exports: [ClosureSchedulerService],
})
export class ClosureModule {}
