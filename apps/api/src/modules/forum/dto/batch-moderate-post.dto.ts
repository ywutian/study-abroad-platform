import {
  IsArray,
  IsString,
  IsEnum,
  IsOptional,
  ArrayMinSize,
  ArrayMaxSize,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BatchModeratePostDto {
  @ApiProperty({ description: 'Post IDs to moderate (max 50)' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  ids: string[];

  @ApiProperty({
    enum: ['delete', 'pin', 'unpin', 'lock', 'unlock'],
    description: 'Moderation action to apply',
  })
  @IsEnum(['delete', 'pin', 'unpin', 'lock', 'unlock'] as const)
  action: 'delete' | 'pin' | 'unpin' | 'lock' | 'unlock';

  @ApiPropertyOptional({ description: 'Reason for moderation action' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
