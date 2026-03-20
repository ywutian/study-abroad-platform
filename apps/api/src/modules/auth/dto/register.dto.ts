import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  @MinLength(8, { message: '密码至少8位' })
  @MaxLength(32, { message: '密码最多32位' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/,
    { message: '密码必须包含大小写字母、数字和特殊字符' },
  )
  password: string;

  @ApiPropertyOptional({
    example: 'zh',
    description: 'User language preference',
  })
  @IsOptional()
  @IsString()
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

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  @MinLength(8, { message: '密码至少8位' })
  @MaxLength(32, { message: '密码最多32位' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/,
    { message: '密码必须包含大小写字母、数字和特殊字符' },
  )
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
  @MaxLength(10)
  locale?: string;
}
