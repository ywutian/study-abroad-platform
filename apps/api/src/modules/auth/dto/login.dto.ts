import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  @MinLength(1, { message: '请输入密码' })
  password: string;
}




