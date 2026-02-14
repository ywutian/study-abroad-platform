import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsString,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TogglePointsDto {
  @ApiProperty({ description: '是否启用积分系统' })
  @IsBoolean()
  enabled: boolean;
}

export class UpdatePointActionDto {
  @ApiProperty({ description: '积分值（正数为奖励，负数为消耗）' })
  @IsNumber()
  points: number;
}

class PointActionUpdate {
  @ApiProperty({ description: '动作名称' })
  @IsString()
  action: string;

  @ApiProperty({ description: '积分值' })
  @IsNumber()
  points: number;
}

export class BatchUpdatePointActionsDto {
  @ApiProperty({ type: [PointActionUpdate], description: '批量更新积分值' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PointActionUpdate)
  actions: PointActionUpdate[];
}
