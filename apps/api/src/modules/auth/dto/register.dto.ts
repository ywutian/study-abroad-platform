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
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/, {
    message: '密码必须包含字母和数字',
  })
  password: string;

  @ApiPropertyOptional({ example: 'zh', description: '用户语言偏好' })
  @IsOptional()
  @IsString()
  locale?: string;
}

export class RefreshTokenDto {
  @ApiPropertyOptional({ description: '可选：优先从 httpOnly cookie 获取' })
  @IsOptional()
  @IsString()
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
