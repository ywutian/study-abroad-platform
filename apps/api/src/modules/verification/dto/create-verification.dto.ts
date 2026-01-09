import { IsString, IsEnum, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ProofType {
  OFFER_LETTER = 'offer_letter',
  ENROLLMENT_PROOF = 'enrollment_proof',
  STUDENT_ID = 'student_id',
}

export class CreateVerificationDto {
  @ApiProperty({ description: '案例ID' })
  @IsString()
  caseId: string;

  @ApiProperty({
    description: '证明类型',
    enum: ProofType,
    example: ProofType.OFFER_LETTER,
  })
  @IsEnum(ProofType)
  proofType: ProofType;

  @ApiProperty({
    description: '证明文件 Base64 数据',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10 * 1024 * 1024) // 10MB max
  proofData?: string;

  @ApiProperty({
    description: '证明文件 URL（如果使用云存储）',
    required: false,
  })
  @IsOptional()
  @IsString()
  proofUrl?: string;
}



