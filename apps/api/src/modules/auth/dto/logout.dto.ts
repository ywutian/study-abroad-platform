import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class LogoutDto {
  @ApiPropertyOptional({
    description:
      'Refresh token (optional, primarily retrieved from httpOnly cookie)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  refreshToken?: string;
}
