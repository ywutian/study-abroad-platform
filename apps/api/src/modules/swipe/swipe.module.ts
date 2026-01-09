import { Module } from '@nestjs/common';
import { SwipeService } from './swipe.service';
import { SwipeController } from './swipe.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [SwipeService],
  controllers: [SwipeController],
  exports: [SwipeService],
})
export class SwipeModule {}



