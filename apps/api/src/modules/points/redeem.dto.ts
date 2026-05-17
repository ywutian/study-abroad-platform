import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional } from 'class-validator';
import { RedemptionType } from '@prisma/client';

/**
 * Hall refactor Stage 7 — points redemption request body.
 */
export class RedeemDto {
  @ApiProperty({ enum: RedemptionType, description: 'Reward type to redeem' })
  @IsEnum(RedemptionType)
  type: RedemptionType;

  @ApiPropertyOptional({
    description:
      'Redemption metadata (e.g. { consultationId?, subscriptionPlan?, caseId? })',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
