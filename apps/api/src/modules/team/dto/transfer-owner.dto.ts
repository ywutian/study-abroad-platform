import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const CUID_REGEX = /^c[a-z0-9]{24}$/i;

export class TransferOwnerDto {
  @ApiProperty({
    description: 'User ID of the new owner (must be current member)',
  })
  @IsString()
  @Matches(CUID_REGEX, { message: 'newOwnerId must be a valid user id' })
  newOwnerId: string;
}
