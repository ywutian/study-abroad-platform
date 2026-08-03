import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { SubscriptionPlan } from '@study-abroad/shared';

export class CreateSubscriptionDto {
  @ApiProperty({ enum: SubscriptionPlan })
  @IsEnum(SubscriptionPlan)
  plan: SubscriptionPlan;

  @ApiProperty({ enum: ['monthly', 'yearly'] })
  @IsIn(['monthly', 'yearly'])
  period: 'monthly' | 'yearly';

  @ApiPropertyOptional({ description: 'Legacy simulator label' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  paymentMethod?: string;
}
