import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { CalculateRankingDto } from './calculate-ranking.dto';

export class SaveRankingDto extends CalculateRankingDto {
  @ApiProperty({ description: 'Display name for the saved ranking' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
