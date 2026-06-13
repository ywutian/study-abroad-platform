import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsString,
  IsArray,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TogglePointsDto {
  @ApiProperty({ description: 'Whether to enable the points system' })
  @IsBoolean()
  enabled: boolean;
}

export class UpdatePointActionDto {
  @ApiProperty({
    description: 'Points value (positive for reward, negative for cost)',
  })
  @IsNumber()
  points: number;
}

class PointActionUpdate {
  @ApiProperty({ description: 'Action name' })
  @IsString()
  @MaxLength(200)
  action: string;

  @ApiProperty({ description: 'Points value' })
  @IsNumber()
  points: number;
}

export class BatchUpdatePointActionsDto {
  @ApiProperty({
    type: [PointActionUpdate],
    description: 'Batch update point values',
  })
  // @arraysize-uncapped-allowed: PUT /admin/points/actions is @Roles(ADMIN)-gated config tooling,
  // bounded by the fixed point-action enum set — not a user-submitted list.
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PointActionUpdate)
  actions: PointActionUpdate[];
}
