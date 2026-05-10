import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { SUPPORTED_LOCALES, type SupportedLocale } from '@study-abroad/shared';

export class UpdateUserLocaleDto {
  @ApiProperty({
    enum: SUPPORTED_LOCALES,
    description: 'User interface and AI output language preference',
  })
  @IsIn(SUPPORTED_LOCALES)
  locale: SupportedLocale;
}
