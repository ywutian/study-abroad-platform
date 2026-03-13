import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum SecurityEventAction {
  APPROVE = 'approve',
  REJECT = 'reject',
}

export class ResolveSecurityEventDto {
  @ApiProperty({
    description: 'Action to take on the security event',
    enum: SecurityEventAction,
  })
  @IsEnum(SecurityEventAction)
  action: 'approve' | 'reject';

  @ApiPropertyOptional({ description: 'Reason for the action' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  reason?: string;
}
