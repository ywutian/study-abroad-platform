import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class JoinByTokenDto {
  @ApiProperty({ description: 'Invitation token' })
  @MaxLength(500)
  @IsString()
  @IsNotEmpty()
  token: string;
}
