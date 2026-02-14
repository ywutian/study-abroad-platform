import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsNumber,
  Min,
} from 'class-validator';

export class BanUserDto {
  @ApiProperty({ description: '封禁原因' })
  @IsString()
  reason: string;

  @ApiPropertyOptional({
    description: '封禁时长（小时），不填则为永久封禁',
    example: 24,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  durationHours?: number;

  @ApiPropertyOptional({ description: '是否永久封禁', default: false })
  @IsOptional()
  @IsBoolean()
  permanent?: boolean;
}
