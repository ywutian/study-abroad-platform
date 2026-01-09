import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestPasswordResetDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: '重置令牌' })
  @IsString()
  token: string;

  @ApiProperty({ example: 'NewPassword123!' })
  @IsString()
  @MinLength(8, { message: '密码至少8位' })
  @MaxLength(32, { message: '密码最多32位' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/, {
    message: '密码必须包含字母和数字',
  })
  newPassword: string;
}

export class ChangePasswordDto {
  @ApiProperty({ description: '当前密码' })
  @IsString()
  @MinLength(1, { message: '请输入当前密码' })
  currentPassword: string;

  @ApiProperty({ example: 'NewPassword123!' })
  @IsString()
  @MinLength(8, { message: '密码至少8位' })
  @MaxLength(32, { message: '密码最多32位' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/, {
    message: '密码必须包含字母和数字',
  })
  newPassword: string;
}









