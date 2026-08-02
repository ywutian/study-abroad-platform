import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
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

/**
 * Admin fulfilment of a PENDING redemption.
 *
 * Every RedemptionType in the enum is delivered by a human — a counselor slot,
 * a manual unlock — so there is no service that can close these out on its own.
 * Without an operator-facing route, `markFulfilled`/`cancel` had no caller at
 * all and a redemption could only ever sit PENDING: points spent, nothing
 * delivered, no way back.
 */
export class FulfillRedemptionDto {
  @ApiPropertyOptional({
    description:
      'What was delivered — e.g. { bookingUrl?, unlockedCaseId?, note? }. Stored under metadata.fulfillment for the audit trail.',
  })
  @IsOptional()
  @IsObject()
  fulfillment?: Record<string, unknown>;
}

/**
 * Admin cancellation of a PENDING redemption. Refunds the points spent.
 */
export class CancelRedemptionDto {
  @ApiProperty({
    description: 'Why this redemption could not be fulfilled (audit trail).',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  reason: string;
}
