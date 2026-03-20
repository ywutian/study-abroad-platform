import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsNumber,
  MaxLength,
  Min,
} from 'class-validator';

export class BanUserDto {
  @ApiProperty({ description: 'Ban reason' })
  @MaxLength(2000)
  @IsString()
  reason: string;

  @ApiPropertyOptional({
    description: 'Ban duration (hours); leave empty for permanent ban',
    example: 24,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  durationHours?: number;

  @ApiPropertyOptional({
    description: 'Whether to permanently ban',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  permanent?: boolean;
}
