import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, MaxLength } from 'class-validator';

export enum BroadcastAudience {
  ALL = 'ALL',
  VERIFIED = 'VERIFIED',
  ADMIN = 'ADMIN',
}

export class BroadcastNotificationDto {
  @ApiProperty({ description: 'Notification title', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty({ description: 'Notification content', maxLength: 5000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string;

  @ApiProperty({ description: 'Target audience', enum: BroadcastAudience })
  @IsEnum(BroadcastAudience)
  audience: BroadcastAudience;
}
