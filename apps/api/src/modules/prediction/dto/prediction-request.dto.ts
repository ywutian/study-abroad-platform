import { IsArray, IsString, IsOptional, ArrayMaxSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PredictionRequestDto {
  @ApiProperty({
    description: '目标学校ID列表',
    example: ['school-id-1', 'school-id-2'],
    type: [String],
    maxItems: 10,
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  schoolIds: string[];

  @ApiProperty({
    description: '是否强制刷新缓存',
    required: false,
    default: false,
  })
  @IsOptional()
  forceRefresh?: boolean;
}



