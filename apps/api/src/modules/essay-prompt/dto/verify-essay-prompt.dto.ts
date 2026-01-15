import { IsString, IsOptional, IsEnum, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EssayStatus } from '../../../common/types/enums';

export class VerifyEssayPromptDto {
  @ApiProperty({ enum: ['VERIFIED', 'REJECTED'], description: '审核状态' })
  @IsEnum(EssayStatus)
  status: EssayStatus;

  @ApiPropertyOptional({ description: '拒绝原因（拒绝时必填）' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class BatchVerifyDto {
  @ApiProperty({ description: '文书ID列表', type: [String] })
  @IsArray()
  @IsString({ each: true })
  ids: string[];

  @ApiProperty({ enum: ['VERIFIED', 'REJECTED'], description: '审核状态' })
  @IsEnum(EssayStatus)
  status: EssayStatus;

  @ApiPropertyOptional({ description: '原因' })
  @IsOptional()
  @IsString()
  reason?: string;
}
