import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { EmailService } from '../../common/email/email.service';
import { User } from '@prisma/client';
import { randomBytes } from 'crypto';

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
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private userService: UserService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {}

  /**
   * Register a new user account with email and password
   * @param data - Registration data containing email, password, and optional locale
   * @throws {ConflictException} When the email is already registered
   * @returns The created user (without password hash) and a success message
   */
  async register(
    data: RegisterDto,
  ): Promise<{ user: Omit<User, 'passwordHash'>; message: string }> {
    // Check if email exists
    const existingUser = await this.userService.findByEmail(data.email);
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 12);

    // Generate email verification token
    const emailVerifyToken = randomBytes(32).toString('hex');

    // Create user
    const user = await this.userService.create({
      email: data.email,
      passwordHash,
      emailVerifyToken,
      locale: data.locale || 'zh',
    });

    // 发送验证邮件 (异步，不阻塞注册流程)
    this.emailService
      .sendVerificationEmail(user.email, emailVerifyToken)
      .catch((err) => {
        this.logger.error(
          `Failed to send verification email to ${user.email}`,
          err,
        );
      });

    const { passwordHash: _, ...result } = user;
    return {
      user: result,
      message:
        'Registration successful. Please check your email to verify your account.',
    };
  }

  /**
   * Authenticate a user with email and password and issue JWT tokens
   * @param data - Login credentials containing email and password
   * @throws {UnauthorizedException} When the credentials are invalid or the user is deleted
   * @returns The authenticated user (without password hash) and access/refresh tokens
   */
  async login(
    data: LoginDto,
  ): Promise<{ user: Omit<User, 'passwordHash'>; tokens: AuthTokens }> {
    const user = await this.userService.findByEmail(data.email);

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      data.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

    const { passwordHash: _, ...result } = user;
    return { user: result, tokens };
  }

  /**
   * Rotate a refresh token by invalidating the old one and issuing a new token pair
   * @param refreshToken - The current refresh token to be rotated
   * @throws {UnauthorizedException} When the refresh token is invalid, expired, or the user is not found
   * @returns A new pair of access and refresh tokens
   */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    // Verify refresh token
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
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

  /**
   * Log out a user by revoking their refresh token(s)
   * @param userId - The ID of the user to log out
   * @param refreshToken - Optional specific refresh token to revoke; if omitted, all tokens for the user are revoked
   * @returns void
   */
  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await this.prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
      });
    } else {
      // Delete all refresh tokens for user
      await this.prisma.refreshToken.deleteMany({
        where: { userId },
      });
    }
  }

  /**
   * Verify a user's email address using the verification token sent via email
   * @param token - The email verification token
   * @throws {BadRequestException} When the verification token is invalid
   * @returns A success message confirming the email was verified
   */
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

    // 发送欢迎邮件
    this.emailService.sendWelcomeEmail(user.email).catch((err) => {
      this.logger.error(`Failed to send welcome email to ${user.email}`, err);
    });

    return { message: 'Email verified successfully' };
  }

  /**
   * Resend the email verification link to a user's email address
   * @param email - The email address to resend the verification link to
   * @throws {BadRequestException} When the email is already verified
   * @returns A generic message that does not reveal whether the email exists
   */
  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const user = await this.userService.findByEmail(email);

    if (!user) {
      // 不透露用户是否存在
      return {
        message: 'If the email exists, a verification link has been sent',
      };
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    // 生成新的验证 token
    const emailVerifyToken = randomBytes(32).toString('hex');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifyToken },
    });

    // 发送验证邮件
    this.emailService
      .sendVerificationEmail(user.email, emailVerifyToken)
      .catch((err) => {
        this.logger.error(
          `Failed to resend verification email to ${user.email}`,
          err,
        );
      });

    return {
      message: 'If the email exists, a verification link has been sent',
    };
  }

  /**
   * Initiate a password reset by generating a reset token and sending a reset email
   * @param email - The email address of the account to reset
   * @returns A generic message that does not reveal whether the email exists
   */
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const user = await this.userService.findByEmail(email);

    if (!user) {
      // Don't reveal if email exists
      return { message: 'If the email exists, a reset link has been sent' };
    }

    const resetToken = randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      },
    });

    // 发送密码重置邮件 (异步)
    this.emailService
      .sendPasswordResetEmail(user.email, resetToken)
      .catch((err) => {
        this.logger.error(
          `Failed to send password reset email to ${user.email}`,
          err,
        );
      });

    return { message: 'If the email exists, a reset link has been sent' };
  }

  /**
   * Reset a user's password using a valid reset token, and invalidate all existing sessions
   * @param token - The password reset token received via email
   * @param newPassword - The new password to set
   * @throws {BadRequestException} When the reset token is invalid or expired
   * @returns A success message confirming the password was reset
   */
  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

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

  /**
   * Change an authenticated user's password after verifying their current password
   * @param userId - The ID of the user changing their password
   * @param currentPassword - The user's current password for verification
   * @param newPassword - The new password to set
   * @throws {UnauthorizedException} When the current password is incorrect
   * @returns A success message confirming the password was changed
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.userService.findByIdOrThrow(userId);

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { message: 'Password changed successfully' };
  }

  private async generateTokens(user: User): Promise<AuthTokens> {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(payload);

    // Generate refresh token
    const refreshToken = randomBytes(64).toString('hex');
    const refreshExpiresIn =
      this.configService.get('JWT_REFRESH_EXPIRES_IN') || '7d';
    const expiresAt = new Date();

    // Parse expiration
    const match = refreshExpiresIn.match(/^(\d+)([dhms])$/);
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

    // Store refresh token
    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }
}
