import { IsString, IsOptional, MaxLength, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/** Cuid format: c + 24 alphanumeric chars */
const CUID_REGEX = /^c[a-z0-9]{24}$/i;

export class InviteDto {
  @ApiPropertyOptional({
    description: 'User ID to invite (cuid); omit for shareable link',
  })
  @IsOptional()
  @IsString()
  @Matches(CUID_REGEX, { message: 'inviteeId must be a valid user id' })
  inviteeId?: string;

  @ApiPropertyOptional({ description: 'Optional message', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  message?: string;
}
