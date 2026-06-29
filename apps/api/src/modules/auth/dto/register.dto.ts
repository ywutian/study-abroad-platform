import {
  IsEmail,
  IsString,
  IsIn,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PASSWORD_POLICY,
  PASSWORD_POLICY_MESSAGE_ZH,
  SUPPORTED_LOCALES,
} from '@study-abroad/shared';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email: string;

  @ApiProperty({ example: 'Password123@' })
  @IsString()
  @MinLength(PASSWORD_POLICY.minLength, { message: '密码至少8位' })
  @MaxLength(PASSWORD_POLICY.maxLength, { message: '密码最多32位' })
  @Matches(PASSWORD_POLICY.requiredPattern, {
    message: PASSWORD_POLICY_MESSAGE_ZH,
  })
  password: string;

  @ApiPropertyOptional({
    example: 'zh',
    description: 'User language preference',
  })
  @IsOptional()
  @IsString()
  @IsIn(SUPPORTED_LOCALES)
  @MaxLength(10)
  locale?: string;

  @ApiPropertyOptional({
    example: 'A1B2C3D4',
    description: 'Referral code (optional)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  referralCode?: string;
}

export class CheckEmailDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  @MaxLength(255)
  email: string;
}

export class RefreshTokenDto {
  @ApiPropertyOptional({
    description: 'Optional: preferably obtained from httpOnly cookie',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  refreshToken?: string;
}

export class ResendVerificationDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email: string;
}

export class RegisterWithInviteDto {
  @ApiProperty({ example: 'operator@example.com' })
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email: string;

  @ApiProperty({ example: 'Password123@' })
  @IsString()
  @MinLength(PASSWORD_POLICY.minLength, { message: '密码至少8位' })
  @MaxLength(PASSWORD_POLICY.maxLength, { message: '密码最多32位' })
  @Matches(PASSWORD_POLICY.requiredPattern, {
    message: PASSWORD_POLICY_MESSAGE_ZH,
  })
  password: string;

  @ApiProperty({ description: 'Operator invite token' })
  @IsString()
  @MaxLength(200)
  inviteToken: string;

  @ApiPropertyOptional({
    example: 'zh',
    description: 'User language preference',
  })
  @IsOptional()
  @IsString()
  @IsIn(SUPPORTED_LOCALES)
  @MaxLength(10)
  locale?: string;
}
