import { IsString, IsEnum, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ReviewAction {
  APPROVE = 'approve',
  REJECT = 'reject',
}

export class ReviewVerificationDto {
  @ApiProperty({
    description: '审核操作',
    enum: ReviewAction,
    example: ReviewAction.APPROVE,
  })
  @IsEnum(ReviewAction)
  action: ReviewAction;

  @ApiProperty({
    description: '审核备注',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
