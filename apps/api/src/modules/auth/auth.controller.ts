import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  HttpCode,
  HttpStatus,
  Res,
  Req,
  Logger,
  UnauthorizedException,
  HttpException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { Public, CurrentUser } from '../../common/decorators';
import {
  ThrottleSensitive,
  ThrottleStrict,
} from '../../common/decorators/throttle.decorator';
import type { CurrentUserPayload } from '../../common/decorators';
import {
  RegisterDto,
  RegisterWithInviteDto,
  RefreshTokenDto,
  ResendVerificationDto,
  ForgotPasswordDto,
  CheckEmailDto,
} from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto, ChangePasswordDto } from './dto/reset-password.dto';
import { LogoutDto } from './dto/logout.dto';
import {
  AuditLogService,
  AuditAction,
} from '../../common/services/audit-log.service';
import { EmailEnumerationGuardService } from './email-enumeration-guard.service';

/**
 * 企业级 Cookie 安全配置
 *
 * Security considerations:
 * - httpOnly: 防止 XSS 攻击窃取 cookie
 * - secure: 生产环境仅通过 HTTPS 传输
 * - sameSite: 防止 CSRF 攻击
 * - path: 限制 cookie 作用域
 * - maxAge: Token 有效期
 */
const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';
const COOKIE_SAME_SITE: 'strict' | 'lax' =
  process.env.NODE_ENV === 'production' ? 'strict' : 'lax';

const REFRESH_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true, // 防止 XSS
  secure: process.env.NODE_ENV === 'production', // 生产环境强制 HTTPS
  sameSite: COOKIE_SAME_SITE, // CSRF 防护
  path: '/', // 全路径，避免负载均衡 URL 重写导致 cookie 不匹配
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 天
};

// 清除 cookie 时使用的配置（必须与设置时相同的 path）
const CLEAR_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: COOKIE_SAME_SITE,
  path: '/',
};

/**
 * Access Token Cookie 配置
 *
 * 用途：供前端 Next.js 中间件检测用户认证状态（路由保护）
 * - httpOnly: 防止 XSS 窃取
 * - path: '/' 让中间件在所有路由可读取
 * - maxAge: 与 JWT 过期时间一致（15 分钟）
 */
const ACCESS_TOKEN_COOKIE_NAME = 'access_token';
const ACCESS_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: COOKIE_SAME_SITE,
  path: '/',
  maxAge: 15 * 60 * 1000, // 15 分钟，与 JWT 过期时间一致
};

const CLEAR_ACCESS_TOKEN_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: COOKIE_SAME_SITE,
  path: '/',
};

@ApiTags('auth')
@ThrottleSensitive()
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly auditLogService: AuditLogService,
    private readonly enumerationGuard: EmailEnumerationGuardService,
  ) {}

  @Post('register')
  @Public()
  @ApiOperation({ summary: 'Register new user and auto-login' })
  async register(
    @Body() data: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(data);

    // Set auth cookies (same as login)
    res.cookie(
      REFRESH_TOKEN_COOKIE_NAME,
      result.tokens.refreshToken,
      REFRESH_TOKEN_COOKIE_OPTIONS,
    );
    res.cookie(
      ACCESS_TOKEN_COOKIE_NAME,
      result.tokens.accessToken,
      ACCESS_TOKEN_COOKIE_OPTIONS,
    );

    return {
      user: result.user,
      accessToken: result.tokens.accessToken,
      message: result.message,
    };
  }

  @Get('check-email')
  @Public()
  @ApiOperation({
    summary:
      'Check whether an email is already registered (signup early-feedback)',
  })
  async checkEmail(@Query() query: CheckEmailDto, @Req() req: Request) {
    // Defense-in-depth over @ThrottleSensitive: a per-IP sustained enumeration
    // guard. Fails open, so a Redis outage degrades to the burst throttle only.
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    const { allowed } = await this.enumerationGuard.hit(ip);
    if (!allowed) {
      throw new HttpException(
        'Too many email checks. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const available = await this.authService.isEmailAvailable(query.email);
    return { available };
  }

  @Post('register/operator')
  @Public()
  @ThrottleStrict()
  @ApiOperation({ summary: 'Register with operator invite token' })
  async registerWithInvite(
    @Body() data: RegisterWithInviteDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.registerWithInvite(data);

    res.cookie(
      REFRESH_TOKEN_COOKIE_NAME,
      result.tokens.refreshToken,
      REFRESH_TOKEN_COOKIE_OPTIONS,
    );
    res.cookie(
      ACCESS_TOKEN_COOKIE_NAME,
      result.tokens.accessToken,
      ACCESS_TOKEN_COOKIE_OPTIONS,
    );

    return {
      user: result.user,
      accessToken: result.tokens.accessToken,
      message: result.message,
    };
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login' })
  async login(
    @Body() data: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.logger.debug(`Login attempt for: ${data.email}`);

    const result = await this.authService.login(data);

    await this.auditLogService.log({
      userId: result.user.id,
      action: AuditAction.LOGIN,
      resource: 'auth',
      ip: req.ip ?? req.socket?.remoteAddress,
      userAgent: req.get('user-agent'),
    });

    // 企业级：设置 httpOnly cookie 存储 refreshToken
    res.cookie(
      REFRESH_TOKEN_COOKIE_NAME,
      result.tokens.refreshToken,
      REFRESH_TOKEN_COOKIE_OPTIONS,
    );

    // 设置 access_token cookie 供前端中间件检测认证状态
    res.cookie(
      ACCESS_TOKEN_COOKIE_NAME,
      result.tokens.accessToken,
      ACCESS_TOKEN_COOKIE_OPTIONS,
    );

    this.logger.log(`User logged in: ${data.email}`);

    const response: Record<string, unknown> = {
      user: result.user,
      accessToken: result.tokens.accessToken,
      isNewUser: result.isNewUser,
    };

    // Mobile clients can't use httpOnly cookies, so they need the token in the body
    if (req.get('x-client-type') === 'mobile') {
      response.refreshToken = result.tokens.refreshToken;
    }

    return response;
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  async refreshToken(
    @Req() req: Request,
    @Body() data: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    // 企业级：优先从 httpOnly cookie 获取，其次从 body 获取（向后兼容）
    const cookieToken: unknown = (
      req.cookies as Record<string, unknown> | undefined
    )?.[REFRESH_TOKEN_COOKIE_NAME];
    const refreshToken =
      (typeof cookieToken === 'string' ? cookieToken : undefined) ||
      data?.refreshToken;

    if (!refreshToken) {
      this.logger.warn('Token refresh attempted without refresh token');
      throw new UnauthorizedException('No refresh token provided');
    }

    try {
      // Token 轮换：刷新时生成新的 refreshToken
      const tokens = await this.authService.refreshToken(refreshToken);

      // 更新 cookie（Token 轮换）
      res.cookie(
        REFRESH_TOKEN_COOKIE_NAME,
        tokens.refreshToken,
        REFRESH_TOKEN_COOKIE_OPTIONS,
      );

      // 同步更新 access_token cookie
      res.cookie(
        ACCESS_TOKEN_COOKIE_NAME,
        tokens.accessToken,
        ACCESS_TOKEN_COOKIE_OPTIONS,
      );

      this.logger.debug('Token refreshed successfully');

      const response: Record<string, unknown> = {
        accessToken: tokens.accessToken,
      };

      if (req.get('x-client-type') === 'mobile') {
        response.refreshToken = tokens.refreshToken;
      }

      return response;
    } catch (error) {
      // 刷新失败时清除可能无效的 cookie
      res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, CLEAR_COOKIE_OPTIONS);
      res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, CLEAR_ACCESS_TOKEN_OPTIONS);
      this.logger.warn(
        `Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  @Post('logout')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout' })
  async logout(
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
    @Body() data: LogoutDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    // 企业级：从 httpOnly cookie 获取 refreshToken
    const cookieToken: unknown = (
      req.cookies as Record<string, unknown> | undefined
    )?.[REFRESH_TOKEN_COOKIE_NAME];
    const refreshToken =
      (typeof cookieToken === 'string' ? cookieToken : undefined) ||
      data?.refreshToken;

    // 即使没有 refreshToken 也要清除 cookie（防止残留）
    await this.authService.logout(user.id, refreshToken);

    await this.auditLogService.log({
      userId: user.id,
      action: AuditAction.LOGOUT,
      resource: 'auth',
      ip: req.ip ?? req.socket?.remoteAddress,
      userAgent: req.get('user-agent'),
    });

    // 清除 cookies
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, CLEAR_COOKIE_OPTIONS);
    res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, CLEAR_ACCESS_TOKEN_OPTIONS);

    this.logger.log(`User logged out: ${user.id}`);

    return { message: 'Logged out successfully' };
  }

  @Get('verify-email')
  @Public()
  @ThrottleStrict()
  @ApiOperation({ summary: 'Verify email' })
  async verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('resend-verification')
  @Public()
  @ThrottleStrict()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend verification email' })
  async resendVerification(@Body() data: ResendVerificationDto) {
    return this.authService.resendVerificationEmail(data.email);
  }

  @Post('forgot-password')
  @Public()
  @ThrottleStrict()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset' })
  async forgotPassword(@Body() data: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(data.email);
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password' })
  async resetPassword(@Body() data: ResetPasswordDto, @Req() req: Request) {
    const { userId, ...result } = await this.authService.resetPassword(
      data.token,
      data.newPassword,
    );
    await this.auditLogService.log({
      userId,
      action: AuditAction.PASSWORD_RESET,
      resource: 'auth',
      ip: req.ip ?? req.socket?.remoteAddress,
      userAgent: req.get('user-agent'),
    });
    return result;
  }

  @Post('change-password')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password' })
  async changePassword(
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
    @Body() data: ChangePasswordDto,
  ) {
    await this.authService.changePassword(
      user.id,
      data.currentPassword,
      data.newPassword,
    );
    await this.auditLogService.log({
      userId: user.id,
      action: AuditAction.PASSWORD_CHANGE,
      resource: 'auth',
      ip: req.ip ?? req.socket?.remoteAddress,
      userAgent: req.get('user-agent'),
    });
    return { message: 'Password changed successfully' };
  }
}
