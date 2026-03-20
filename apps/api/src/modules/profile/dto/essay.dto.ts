import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEssayDto {
  @ApiProperty({ description: 'Essay title' })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ description: 'Essay prompt/Prompt' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  prompt?: string;

  @ApiProperty({ description: 'Essay content' })
  @IsString()
  @MaxLength(50000)
  content: string;

  @ApiPropertyOptional({ description: 'Associated school ID' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  schoolId?: string;
}

export class UpdateEssayDto {
  @ApiPropertyOptional({ description: 'Essay title' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ description: 'Essay prompt/Prompt' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  prompt?: string;

  @ApiPropertyOptional({ description: 'Essay content' })
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  content?: string;

  @ApiPropertyOptional({ description: 'Associated school ID' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  schoolId?: string;
}
