import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  MaxLength,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EssayStatus } from '../../../common/types/enums';

export class VerifyEssayPromptDto {
  @ApiProperty({ enum: ['VERIFIED', 'REJECTED'], description: 'Review status' })
  @IsEnum(EssayStatus)
  status: EssayStatus;

  @ApiPropertyOptional({
    description: 'Rejection reason (required when rejecting)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class BatchVerifyDto {
  @ApiProperty({ description: 'Essay ID list', type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  ids: string[];

  @ApiProperty({ enum: ['VERIFIED', 'REJECTED'], description: 'Review status' })
  @IsEnum(EssayStatus)
  status: EssayStatus;

  @ApiPropertyOptional({ description: 'Reason' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
