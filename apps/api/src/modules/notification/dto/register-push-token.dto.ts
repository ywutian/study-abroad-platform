import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength } from 'class-validator';

export class RegisterPushTokenDto {
  @ApiProperty({
    description: 'Expo push token returned by expo-notifications',
    example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
  })
  @IsString()
  @MaxLength(255)
  token!: string;

  @ApiProperty({
    description: 'Client platform for the registered device token',
    enum: ['ios', 'android'],
    example: 'android',
  })
  @IsString()
  @IsIn(['ios', 'android'])
  platform!: 'ios' | 'android';
}
