import {
  IsArray,
  IsString,
  IsOptional,
  IsNotEmpty,
  ArrayMaxSize,
  ArrayMinSize,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PredictionRequestDto {
  @ApiProperty({
    description: '目标学校ID列表',
    example: ['school-id-1', 'school-id-2'],
    type: [String],
    minItems: 1,
    maxItems: 10,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  @IsNotEmpty({ each: true })
  schoolIds: string[];

  @ApiProperty({
    description: '是否强制刷新缓存',
    required: false,
    default: false,
  })
  @IsOptional()
  forceRefresh?: boolean;
}
