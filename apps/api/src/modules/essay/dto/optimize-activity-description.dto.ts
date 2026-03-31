import { IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OptimizeActivityDescriptionDto {
  @ApiProperty({
    description: 'Current activity description to optimize',
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  description: string;

  @ApiProperty({
    description: 'Activity name (e.g., "Math Olympiad Team")',
    maxLength: 200,
  })
  @IsString()
  @MaxLength(200)
  activityName: string;

  @ApiProperty({
    description: 'Role/position held (e.g., "Team Captain")',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  role: string;
}
