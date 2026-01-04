import { Controller, Post, Body, Get, Query, HttpCode, HttpStatus, Res, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiBody } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { IsString } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { Public, CurrentUser } from '../../common/decorators';
import { ThrottleSensitive, ThrottleStrict } from '../../common/decorators/throttle.decorator';
import type { CurrentUserPayload } from '../../common/decorators';
import {
  RegisterDto,
  LoginDto,
  ResetPasswordDto,
  ChangePasswordDto,
  RequestPasswordResetDto,
} from './dto';

const REFRESH_TOKEN_COOKIE = 'refresh_token';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @Public()
  @ThrottleSensitive()
  @ApiOperation({ summary: '用户注册', description: '创建新用户账号，发送验证邮件' })
  @ApiResponse({ status: 201, description: '注册成功，验证邮件已发送' })
  @ApiResponse({ status: 409, description: '邮箱已被注册' })
  @ApiResponse({ status: 429, description: '请求过于频繁，请稍后再试' })
  async register(@Body() data: RegisterDto) {
    return this.authService.register(data);
  }

  @Post('login')
  @Public()
  @ThrottleSensitive()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '用户登录', description: '使用邮箱密码登录，返回访问令牌' })
  @ApiResponse({ status: 200, description: '登录成功' })
  @ApiResponse({ status: 401, description: '邮箱或密码错误' })
  @ApiResponse({ status: 429, description: '请求过于频繁，请稍后再试' })
  async login(@Body() data: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(data);
    
    // Set refresh token as httpOnly cookie
    res.cookie(REFRESH_TOKEN_COOKIE, result.tokens.refreshToken, COOKIE_OPTIONS);
    
    return {
      user: result.user,
      accessToken: result.tokens.accessToken,
      // Also return refreshToken for backward compatibility with mobile apps
      refreshToken: result.tokens.refreshToken,
    };
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '刷新 Access Token', description: '使用 Refresh Token 获取新的 Access Token' })
  @ApiResponse({ status: 200, description: '刷新成功' })
  @ApiResponse({ status: 401, description: 'Refresh Token 无效或已过期' })
  async refreshToken(
    @Body() data: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Try to get refresh token from cookie first, then from body
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] || data.refreshToken;
    
    if (!refreshToken) {
      throw new Error('Refresh token is required');
    }
    
    const tokens = await this.authService.refreshToken(refreshToken);
    
    // Update cookie with new refresh token
    res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, COOKIE_OPTIONS);
    
    return tokens;
  }

  @Post('logout')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '退出登录', description: '使当前会话的 Refresh Token 失效' })
  @ApiResponse({ status: 200, description: '退出成功' })
  async logout(
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() data?: { refreshToken?: string },
  ) {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] || data?.refreshToken;
    await this.authService.logout(user.id, refreshToken);
    
    // Clear the refresh token cookie
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/auth' });
    
    return { message: 'Logged out successfully' };
  }

  @Get('verify-email')
  @Public()
  @ApiOperation({ summary: '验证邮箱', description: '通过邮件中的链接验证邮箱地址' })
  @ApiResponse({ status: 200, description: '验证成功' })
  @ApiResponse({ status: 400, description: '验证令牌无效' })
  async verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('forgot-password')
  @Public()
  @ThrottleStrict()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '忘记密码', description: '发送密码重置邮件' })
  @ApiResponse({ status: 200, description: '如果邮箱存在，重置邮件已发送' })
  @ApiResponse({ status: 429, description: '请求过于频繁，请稍后再试' })
  async forgotPassword(@Body() data: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(data.email);
  }

  @Post('reset-password')
  @Public()
  @ThrottleSensitive()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '重置密码', description: '使用重置令牌设置新密码' })
  @ApiResponse({ status: 200, description: '密码重置成功' })
  @ApiResponse({ status: 400, description: '重置令牌无效或已过期' })
  @ApiResponse({ status: 429, description: '请求过于频繁，请稍后再试' })
  async resetPassword(@Body() data: ResetPasswordDto) {
    return this.authService.resetPassword(data.token, data.newPassword);
  }

  @Post('change-password')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '修改密码', description: '已登录用户修改密码' })
  @ApiResponse({ status: 200, description: '密码修改成功' })
  @ApiResponse({ status: 401, description: '当前密码错误' })
  async changePassword(@CurrentUser() user: CurrentUserPayload, @Body() data: ChangePasswordDto) {
    return this.authService.changePassword(user.id, data.currentPassword, data.newPassword);
  }
}
