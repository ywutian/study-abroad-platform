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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { Public, CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import {
  RegisterDto,
  RefreshTokenDto,
  ResendVerificationDto,
  ForgotPasswordDto,
} from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto, ChangePasswordDto } from './dto/reset-password.dto';

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
const REFRESH_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true, // 防止 XSS
  secure: process.env.NODE_ENV === 'production', // 生产环境强制 HTTPS
  sameSite: (process.env.NODE_ENV === 'production' ? 'strict' : 'lax') as const, // CSRF 防护
  path: '/api/v1/auth', // 限制到认证路径
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 天
};

// 清除 cookie 时使用的配置（必须与设置时相同的 path）
const CLEAR_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.NODE_ENV === 'production' ? 'strict' : 'lax') as const,
  path: '/api/v1/auth',
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
  sameSite: (process.env.NODE_ENV === 'production' ? 'strict' : 'lax') as const,
  path: '/',
  maxAge: 15 * 60 * 1000, // 15 分钟，与 JWT 过期时间一致
};

const CLEAR_ACCESS_TOKEN_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.NODE_ENV === 'production' ? 'strict' : 'lax') as const,
  path: '/',
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Register new user' })
  async register(@Body() data: RegisterDto) {
    return this.authService.register(data);
  }

  @Post('login')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login' })
  async login(
    @Body() data: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.logger.debug(`Login attempt for: ${data.email}`);

    const result = await this.authService.login(data);

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

    return {
      user: result.user,
      accessToken: result.tokens.accessToken,
      // 安全：不在响应体中返回 refreshToken
    };
  }

  @Post('refresh')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  async refreshToken(
    @Req() req: Request,
    @Body() data: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    // 企业级：优先从 httpOnly cookie 获取，其次从 body 获取（向后兼容）
    const refreshToken =
      req.cookies?.[REFRESH_TOKEN_COOKIE_NAME] || data?.refreshToken;

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

      return {
        accessToken: tokens.accessToken,
      };
    } catch (error) {
      // 刷新失败时清除可能无效的 cookie
      res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, CLEAR_COOKIE_OPTIONS);
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
    @Body() data: { refreshToken?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    // 企业级：从 httpOnly cookie 获取 refreshToken
    const refreshToken =
      req.cookies?.[REFRESH_TOKEN_COOKIE_NAME] || data?.refreshToken;

    // 即使没有 refreshToken 也要清除 cookie（防止残留）
    await this.authService.logout(user.id, refreshToken);

    // 清除 cookies
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, CLEAR_COOKIE_OPTIONS);
    res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, CLEAR_ACCESS_TOKEN_OPTIONS);

    this.logger.log(`User logged out: ${user.id}`);

    return { message: 'Logged out successfully' };
  }

  @Get('verify-email')
  @Public()
  @ApiOperation({ summary: 'Verify email' })
  async verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('resend-verification')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend verification email' })
  async resendVerification(@Body() data: ResendVerificationDto) {
    return this.authService.resendVerificationEmail(data.email);
  }

  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset' })
  async forgotPassword(@Body() data: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(data.email);
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password' })
  async resetPassword(@Body() data: ResetPasswordDto) {
    return this.authService.resetPassword(data.token, data.newPassword);
  }

  @Post('change-password')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password' })
  async changePassword(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      user.id,
      data.currentPassword,
      data.newPassword,
    );
  }
}
