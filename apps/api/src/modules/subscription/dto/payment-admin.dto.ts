import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';
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
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
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
  reason?: string;
}
