import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class EssaySuggestEditsRequestDto {
  @ApiProperty({ description: 'Essay ID' })
  @IsString()
  @MaxLength(200)
  essayId: string;

  @ApiPropertyOptional({
    description: 'Editing style',
    enum: ['formal', 'vivid', 'concise'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['formal', 'vivid', 'concise'])
  style?: 'formal' | 'vivid' | 'concise';

  @ApiPropertyOptional({ description: 'Optional editing focus' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  focus?: string;
}

export class EssaySuggestionItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  kind: string;

  @ApiPropertyOptional()
  originalText?: string | null;

  @ApiProperty()
  replacementText: string;

  @ApiProperty()
  reason: string;

  @ApiPropertyOptional()
  impact?: string | null;

  @ApiProperty()
  status: string;

  @ApiProperty()
  insertMode: string;
}

export class EssaySuggestEditsResponseDto {
  @ApiProperty({ type: [EssaySuggestionItemDto] })
  suggestions: EssaySuggestionItemDto[];

  @ApiProperty()
  revisionId: string;

  @ApiProperty()
  tokenUsed: number;
}
