import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectAgentApprovalDto {
  @ApiPropertyOptional({
    description: 'Optional reason for rejecting the action',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
