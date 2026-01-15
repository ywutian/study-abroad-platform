import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export enum PolishStyle {
  FORMAL = 'formal',
  VIVID = 'vivid',
  CONCISE = 'concise',
}

export class EssayPolishRequestDto {
  @ApiProperty({ description: '文书ID' })
  @IsString()
  @IsNotEmpty()
  essayId: string;

  @ApiProperty({
    description: '要润色的内容（可选，默认使用文书全文）',
    required: false,
  })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiProperty({ enum: PolishStyle, description: '润色风格', required: false })
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
