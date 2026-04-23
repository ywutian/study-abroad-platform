import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import type { BenchmarkProfileInput } from '@study-abroad/shared';

export class CreateBenchmarkProfileDto {
  @ApiProperty({ required: false, maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;

  @ApiProperty({
    required: false,
    type: Object,
    additionalProperties: true,
    description: 'Serialized benchmark profile input',
  })
  @IsOptional()
  @IsObject()
  profileJson?: BenchmarkProfileInput;
}

export class StartBenchmarkRunDto {
  @ApiProperty({ required: false, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  profileId?: string;

  @ApiProperty({ required: false, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourceKey?: string;

  @ApiProperty({ required: false, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  headed?: boolean;
}
