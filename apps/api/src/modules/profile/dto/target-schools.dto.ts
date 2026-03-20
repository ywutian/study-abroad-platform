import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsObject,
  MaxLength,
} from 'class-validator';

export class SetTargetSchoolsDto {
  @ApiProperty({ description: 'School ID list', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  schoolIds: string[];

  @ApiPropertyOptional({
    description: 'Priority映射 (schoolId -> priority 1-3)',
    example: { 'school-1': 1, 'school-2': 2 },
  })
  @IsOptional()
  @IsObject()
  priorities?: Record<string, number>;
}

export class AddTargetSchoolDto {
  @ApiPropertyOptional({
    description: 'Priority (1=Reach, 2=Target, 3=Safety)',
    minimum: 1,
    maximum: 3,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  priority?: number;
}
