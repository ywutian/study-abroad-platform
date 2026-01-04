import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
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

    // Send password reset email
    await this.emailService.sendPasswordResetEmail(user.email, resetToken);

    return { message: 'If the email exists, a reset link has been sent' };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: token,
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

  private async generateTokens(user: User): Promise<AuthTokens> {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(payload);

    // Generate refresh token
    const refreshToken = randomBytes(64).toString('hex');
    const refreshExpiresIn = this.configService.get('JWT_REFRESH_EXPIRES_IN') || '7d';
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

