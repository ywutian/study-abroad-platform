import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class VaultExportDto {
  @ApiProperty({ description: 'User password confirmation' })
  @MaxLength(128)
  @IsString()
  @IsNotEmpty()
  password: string;
}
