import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class UpdateSchoolCommunityRatingDto {
  @ApiProperty({
    description: 'Campus safety rating (1-5)',
    minimum: 1,
    maximum: 5,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  safetyRating: number;

  @ApiProperty({
    description: 'Campus life rating (1-5)',
    minimum: 1,
    maximum: 5,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  lifeRating: number;

  @ApiProperty({
    description: 'Campus food rating (1-5)',
    minimum: 1,
    maximum: 5,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  foodRating: number;
}
