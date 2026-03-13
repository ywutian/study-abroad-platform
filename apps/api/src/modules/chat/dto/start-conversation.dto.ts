import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StartConversationDto {
  @ApiProperty({ description: '目标用户ID' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  userId: string;
}
