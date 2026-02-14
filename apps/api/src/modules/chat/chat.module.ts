import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatAdminController } from './chat-admin.controller';
import { MessageFilterService } from './message-filter.service';
import { RedisModule } from '../../common/redis/redis.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: configService.get('JWT_EXPIRES_IN', '15m') },
      }),
    }),
    RedisModule,
    forwardRef(() => NotificationModule),
  ],
  controllers: [ChatController, ChatAdminController],
  providers: [ChatService, ChatGateway, MessageFilterService],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
