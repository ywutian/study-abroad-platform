import { IsEmail, IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsStrongPassword } from '../../../common/validators/password.validator';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', description: '邮箱地址' })
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email: string;

  @ApiProperty({
    example: 'Password123',
    description: '密码 (8-128位，包含大小写字母和数字)',
  })
  @IsString()
  @IsStrongPassword({
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: false,
  })
  password: string;

  @ApiPropertyOptional({ example: 'zh', description: '语言偏好' })
  @IsOptional()
  @IsIn(['zh', 'en'], { message: '语言只支持 zh 或 en' })
  locale?: string;
}


