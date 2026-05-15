import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional } from 'class-validator';

export class UpdateConversationPreferencesDto {
  @ApiPropertyOptional({
    description: 'Pin or unpin this conversation for the current user',
  })
  @IsBoolean()
  @IsOptional()
  isPinned?: boolean;

  @ApiPropertyOptional({
    description: 'Archive or unarchive this conversation for the current user',
  })
  @IsBoolean()
  @IsOptional()
  isArchived?: boolean;

  @ApiPropertyOptional({
    description:
      'Mute until this ISO timestamp; pass null from clients by omitting to leave unchanged',
  })
  @IsDateString()
  @IsOptional()
  mutedUntil?: string | null;
}
