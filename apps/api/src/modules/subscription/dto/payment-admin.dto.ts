import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
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
  @ApiPropertyOptional({ description: 'Refund reason' })
  @IsOptional()
  @MaxLength(2000)
  @IsString()
  reason?: string;
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
