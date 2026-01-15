import { Module, forwardRef } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { ChatModule } from '../chat/chat.module';
import { RedisModule } from '../../common/redis/redis.module';

@Module({
  imports: [RedisModule, forwardRef(() => ChatModule)],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
