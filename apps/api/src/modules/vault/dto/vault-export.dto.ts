import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class VaultExportDto {
  @ApiProperty({ description: '用户密码确认' })
  @MaxLength(128)
  @IsString()
  @IsNotEmpty()
  password: string;
}
