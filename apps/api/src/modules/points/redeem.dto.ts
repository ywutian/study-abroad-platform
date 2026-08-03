import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
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

/**
 * What happened in the consultation a redemption bought.
 *
 * FULFILLED is not the end of a CONSULT_15MIN — it only records that a booking
 * link went out. The 15 minutes themselves are the highest-intent moment in the
 * product: the user on the other side spent 2000 points, which means a complete
 * profile, a run prediction and roughly a month of contributed case studies.
 * Nothing recorded what came of it, so there was no way to answer whether the
 * 2000-point threshold is right, whether people who book actually attend, or
 * what fraction convert — the three numbers any pricing decision needs.
 *
 * Deliberately stored under `metadata.outcome` rather than as columns. The
 * shape of these fields is a guess until counselors have used them for a
 * couple of months: whether intent wants three buckets or five, whether
 * lostReason should become an enum, whether budget belongs here at all. A Json
 * column absorbs that without a migration per revision.
 *
 * The cost is that this cannot be aggregated in SQL — a conversion rate means
 * scanning the table. That is the right trade only while the volume is small
 * enough to count by hand; once it is not, the shape has stabilised and these
 * belong in a ConsultationOutcome table with real columns and an index. Do not
 * skip ahead to that table: this repo already carries `hallAvgRating` /
 * `hallReviewCount`, columns added for a consumer that was never wired up, with
 * no writer and no reader anywhere in the codebase.
 */
export class RecordConsultationOutcomeDto {
  @ApiProperty({ description: 'Did the user actually attend the session?' })
  @IsBoolean()
  attended: boolean;

  @ApiPropertyOptional({
    description:
      "The counselor's read on intent. Absent when attended is false.",
    enum: ['HOT', 'WARM', 'COLD'],
  })
  @IsOptional()
  @IsIn(['HOT', 'WARM', 'COLD'])
  intent?: 'HOT' | 'WARM' | 'COLD';

  @ApiPropertyOptional({
    description: 'Amount quoted, in CNY. Omit if no quote was given.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  quotedAmount?: number;

  @ApiPropertyOptional({ description: 'Did it convert to a paid engagement?' })
  @IsOptional()
  @IsBoolean()
  converted?: boolean;

  @ApiPropertyOptional({
    description:
      'Why it did not convert. Free text on purpose — enumerate it once the same handful of reasons keeps recurring.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  lostReason?: string;

  @ApiPropertyOptional({
    description: 'Which counselor took the session.',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  counselorId?: string;
}
