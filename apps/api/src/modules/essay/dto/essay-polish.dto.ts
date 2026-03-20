import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  MaxLength,
} from 'class-validator';

export enum PolishStyle {
  FORMAL = 'formal',
  VIVID = 'vivid',
  CONCISE = 'concise',
}

export class EssayPolishRequestDto {
  @ApiProperty({ description: 'Essay ID' })
  @MaxLength(500)
  @IsString()
  @IsNotEmpty()
  essayId: string;

  @ApiProperty({
    description: 'Content to polish (optional, defaults to full essay text)',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(50000)
  content?: string;

  @ApiProperty({
    enum: PolishStyle,
    description: 'Polish style',
    required: false,
  })
  @IsEnum(PolishStyle)
  @IsOptional()
  style?: PolishStyle;
}

export class EssayPolishChangeDto {
  @ApiProperty()
  original: string;

  @ApiProperty()
  revised: string;

  @ApiProperty()
  reason: string;
}

export class EssayPolishResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  polished: string;

  @ApiProperty({ type: [EssayPolishChangeDto] })
  changes: EssayPolishChangeDto[];

  @ApiProperty()
  tokenUsed: number;
}
