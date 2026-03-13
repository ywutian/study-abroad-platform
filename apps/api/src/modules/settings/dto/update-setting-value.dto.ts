import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSettingValueDto {
  @ApiProperty({ description: 'Setting value' })
  @IsString()
  @MaxLength(5000)
  value: string;

  @ApiPropertyOptional({ description: 'Setting description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateSettingItemDto {
  @ApiProperty({ description: 'Setting key' })
  @IsString()
  @MaxLength(500)
  key: string;

  @ApiProperty({ description: 'Setting value' })
  @IsString()
  @MaxLength(5000)
  value: string;
}
