import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RewriteParagraphDto {
  @ApiProperty({ description: 'Paragraph to rewrite' })
  @IsString()
  @MaxLength(5000)
  paragraph: string;

  @ApiPropertyOptional({
    description: 'Rewrite instructions/special requirements',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  instruction?: string;
}
