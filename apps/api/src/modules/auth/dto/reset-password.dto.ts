import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  PASSWORD_POLICY,
  PASSWORD_POLICY_MESSAGE_ZH,
} from '@study-abroad/shared';

export class RequestPasswordResetDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Reset token' })
  @IsString()
  @IsNotEmpty({ message: 'Reset token不能为空' })
  @MaxLength(500)
  token: string;

  @ApiProperty({ example: 'NewPassword123@' })
  @IsString()
  @MinLength(PASSWORD_POLICY.minLength, { message: '密码至少8位' })
  @MaxLength(PASSWORD_POLICY.maxLength, { message: '密码最多32位' })
  @Matches(PASSWORD_POLICY.requiredPattern, {
    message: PASSWORD_POLICY_MESSAGE_ZH,
  })
  newPassword: string;
}

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current password' })
  @IsString()
  @MinLength(1, { message: '请输入Current password' })
  @MaxLength(128)
  currentPassword: string;

  @ApiProperty({ example: 'NewPassword123@' })
  @IsString()
  @MinLength(PASSWORD_POLICY.minLength, { message: '密码至少8位' })
  @MaxLength(PASSWORD_POLICY.maxLength, { message: '密码最多32位' })
  @Matches(PASSWORD_POLICY.requiredPattern, {
    message: PASSWORD_POLICY_MESSAGE_ZH,
  })
  newPassword: string;
}
