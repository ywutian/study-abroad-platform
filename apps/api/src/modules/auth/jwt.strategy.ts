import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private userService: UserService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('FATAL: JWT_SECRET environment variable is not set');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.userService.findById(payload.sub);

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('User not found or deleted');
    }

    // [SECURITY] Check ban status at the strategy level so WebSocket gateway
    // auth (which bypasses JwtAuthGuard) also rejects banned users.
    if (user.isBanned) {
      if (!user.bannedUntil || new Date() <= user.bannedUntil) {
        throw new ForbiddenException('Account is banned');
      }
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: user.role,
      locale: user.locale || 'zh',
    };
  }
}
