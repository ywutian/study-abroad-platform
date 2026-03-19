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
  @ApiPropertyOptional({ description: '退款原因' })
  @IsOptional()
  @MaxLength(2000)
  @IsString()
  reason?: string;
}

export class UpdateSubscriptionDto {
  @ApiPropertyOptional({
    description: '目标订阅方案（推荐）',
    enum: SubscriptionPlan,
  })
  @IsOptional()
  @IsEnum(SubscriptionPlan)
  plan?: SubscriptionPlan;

  @ApiPropertyOptional({
    description: '目标角色（兼容旧客户端）',
    enum: Role,
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ description: '原因' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
