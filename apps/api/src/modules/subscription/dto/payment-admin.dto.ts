import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { PaymentStatus, Role } from '@prisma/client';
import { SubscriptionPlan } from '@study-abroad/shared';

export class PaymentQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @MaxLength(100)
  @IsString()
  plan?: string;

  @ApiPropertyOptional()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  pageSize?: number;
}

export class RefundPaymentDto {
  @ApiProperty({ description: 'Refund reason (required for audit trail)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;
}

export class UpdateSubscriptionDto {
  @ApiPropertyOptional({
    description: 'Target subscription plan (recommended)',
    enum: SubscriptionPlan,
  })
  @IsOptional()
  @IsEnum(SubscriptionPlan)
  plan?: SubscriptionPlan;

  @ApiPropertyOptional({
    description: 'Target role (compatible with legacy clients)',
    enum: Role,
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ description: 'Reason' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
