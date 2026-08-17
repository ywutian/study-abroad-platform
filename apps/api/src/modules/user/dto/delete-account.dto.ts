import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class DeleteAccountDto {
  @ApiProperty({
    description:
      'Current password; required to soft-delete the signed-in account',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}
