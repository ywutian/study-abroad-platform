import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { TokenCleanupScheduler } from './token-cleanup.scheduler';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    UserModule,
    ScheduleModule.forRoot(),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const jwtSecret = configService.get<string>('JWT_SECRET');
        if (!jwtSecret) {
          throw new Error('FATAL: JWT_SECRET environment variable is not set');
        }
        return {
          secret: jwtSecret,
          signOptions: {
            expiresIn: configService.get('JWT_EXPIRES_IN') || '15m',
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, TokenCleanupScheduler],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}

