import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateBenchmarkCommentDto {
  @ApiProperty({
    description: 'Free-form review note. Plain text, no markdown rendering.',
    minLength: 1,
    maxLength: 4000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;

  @ApiProperty({
    description:
      'Optional anchor pointing at a specific test or case being commented on. Examples: "test:cds-band-consistency", "case:stanford-rea". Null = top-level comment on the whole run.',
    required: false,
    maxLength: 80,
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  anchor?: string;
}
