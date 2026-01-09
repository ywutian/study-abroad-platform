import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { EmailService } from '../../common/email/email.service';
import { User } from '@prisma/client';
import { randomBytes, createHash } from 'crypto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface RegisterDto {
  email: string;
  password: string;
  locale?: string;
}

interface LoginDto {
  email: string;
  password: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private userService: UserService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService
  ) {}

  async register(data: RegisterDto): Promise<{ user: Omit<User, 'passwordHash'>; message: string }> {
    // Check if email exists
    const existingUser = await this.userService.findByEmail(data.email);
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Generate email verification token
    const emailVerifyToken = randomBytes(32).toString('hex');

    // Create user
    const user = await this.userService.create({
      email: data.email,
      passwordHash,
      emailVerifyToken,
      locale: data.locale || 'zh',
    });

    // Send verification email
    await this.emailService.sendVerificationEmail(user.email, emailVerifyToken);

    const { passwordHash: _, ...result } = user;
    return {
      user: result,
      message: 'Registration successful. Please check your email to verify your account.',
    };
  }

  async login(data: LoginDto): Promise<{ user: Omit<User, 'passwordHash'>; tokens: AuthTokens }> {
    const user = await this.userService.findByEmail(data.email);

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

    const { passwordHash: _, ...result } = user;
    return { user: result, tokens };
  }

  /**
   * 刷新访问令牌
   * 
   * 安全设计：
   * - 对用户提供的 RefreshToken 进行哈希后与数据库中的哈希值比较
   * - Token 轮换：每次刷新都生成新的 RefreshToken
   */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    // 对用户提供的 token 进行哈希
    const tokenHash = this.hashRefreshToken(refreshToken);
    
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: tokenHash },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.userService.findById(storedToken.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Delete old refresh token
    await this.prisma.refreshToken.delete({
      where: { id: storedToken.id },
    });

    // Generate new tokens
    return this.generateTokens(user);
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      // 对用户提供的 token 进行哈希后删除
      const tokenHash = this.hashRefreshToken(refreshToken);
      await this.prisma.refreshToken.deleteMany({
        where: { token: tokenHash },
      });
    } else {
      // Delete all refresh tokens for user
      await this.prisma.refreshToken.deleteMany({
        where: { userId },
      });
    }
  }

  /**
   * 哈希 RefreshToken
   * 使用 SHA-256 确保数据库泄露时 token 无法被直接使用
   */
  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({
      where: { emailVerifyToken: token },
    });

    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifyToken: null,
      },
    });

    return { message: 'Email verified successfully' };
  }

  /**
   * 请求密码重置
   * 
   * 安全设计：
   * - 生成随机 Token 发送给用户
   * - 数据库中只存储 Token 的 SHA-256 哈希值
   * - 即使数据库泄露，攻击者也无法直接使用 Token
   */
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const user = await this.userService.findByEmail(email);

    if (!user) {
      // Don't reveal if email exists
      return { message: 'If the email exists, a reset link has been sent' };
    }

    // 生成原始 Token
    const resetToken = randomBytes(32).toString('hex');
    
    // 存储哈希值而非原始 Token（安全增强）
    const resetTokenHash = createHash('sha256')
      .update(resetToken)
      .digest('hex');
    
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetTokenHash, // 存储哈希值
        passwordResetExpires: resetExpires,
      },
    });

    // 发送原始 Token 给用户
    await this.emailService.sendPasswordResetEmail(user.email, resetToken);

    return { message: 'If the email exists, a reset link has been sent' };
  }

  /**
   * 重置密码
   * 
   * 安全设计：
   * - 对用户提供的 Token 进行哈希后与数据库中的哈希值比较
   * - 重置成功后清除所有 refresh tokens，强制重新登录
   */
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    // 对用户提供的 Token 进行哈希，与数据库中的哈希值比较
    const tokenHash = createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: tokenHash, // 比较哈希值
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    // Invalidate all refresh tokens
    await this.prisma.refreshToken.deleteMany({
      where: { userId: user.id },
    });

    return { message: 'Password reset successful' };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.userService.findByIdOrThrow(userId);

    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { message: 'Password changed successfully' };
  }

  /**
   * 生成访问令牌和刷新令牌
   * 
   * 安全设计：
   * - RefreshToken 生成后进行哈希，数据库只存储哈希值
   * - 返回原始 token 给客户端，客户端无需知道哈希逻辑
   */
  private async generateTokens(user: User): Promise<AuthTokens> {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(payload);

    // Generate refresh token (原始值)
    const refreshToken = randomBytes(64).toString('hex');
    // 存储哈希值
    const tokenHash = this.hashRefreshToken(refreshToken);
    
    const refreshExpiresIn = this.configService.get('JWT_REFRESH_EXPIRES_IN') || '7d';
    const expiresAt = this.parseExpiration(refreshExpiresIn);

    // Store hashed refresh token
    await this.prisma.refreshToken.create({
      data: {
        token: tokenHash,  // 存储哈希值，非原始 token
        userId: user.id,
        expiresAt,
      },
    });

    // 返回原始 token 给客户端
    return { accessToken, refreshToken };
  }

  /**
   * 解析过期时间字符串
   */
  private parseExpiration(expiresIn: string): Date {
    const expiresAt = new Date();
    const match = expiresIn.match(/^(\d+)([dhms])$/);
    
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2];
      switch (unit) {
        case 'd':
          expiresAt.setDate(expiresAt.getDate() + value);
          break;
        case 'h':
          expiresAt.setHours(expiresAt.getHours() + value);
          break;
        case 'm':
          expiresAt.setMinutes(expiresAt.getMinutes() + value);
          break;
        case 's':
          expiresAt.setSeconds(expiresAt.getSeconds() + value);
          break;
      }
    } else {
      expiresAt.setDate(expiresAt.getDate() + 7); // Default 7 days
    }
    
    return expiresAt;
  }
}

