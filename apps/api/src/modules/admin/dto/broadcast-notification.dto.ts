import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, MaxLength } from 'class-validator';

export enum BroadcastAudience {
  ALL = 'ALL',
  VERIFIED = 'VERIFIED',
  ADMIN = 'ADMIN',
}

export class BroadcastNotificationDto {
  @ApiProperty({ description: '通知标题', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty({ description: '通知内容', maxLength: 5000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string;

  @ApiProperty({ description: '目标受众', enum: BroadcastAudience })
  @IsEnum(BroadcastAudience)
  audience: BroadcastAudience;
}
