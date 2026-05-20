import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

/**
 * Body for `POST /essay-debate/turn` — one round of argument from the user.
 *
 * Phase 2 V1 PR1 ships only the skeleton: the service returns a mock
 * response and writes the turn into `EssayDebateSession.turns`. PR2 wires
 * the 6 context classes (see `CONTEXT_AUDIT.md`) and a real Claude call.
 *
 * Either `admissionCaseId` (debate a gallery essay) or `essayId` (debate
 * AI feedback on your own draft) is required — never both, never neither.
 * `sessionId` continues an existing debate; omit it to create a new one.
 */
export class CreateDebateTurnDto {
  @ApiPropertyOptional({
    description:
      'Existing session to continue. Omit to start a new debate against the case/essay below.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sessionId?: string;

  @ApiPropertyOptional({
    description:
      'Gallery case to argue against. Mutually exclusive with `essayId`.',
  })
  @ValidateIf((o: CreateDebateTurnDto) => !o.essayId)
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  admissionCaseId?: string;

  @ApiPropertyOptional({
    description:
      'User-owned essay to argue against. Mutually exclusive with `admissionCaseId`.',
  })
  @ValidateIf((o: CreateDebateTurnDto) => !o.admissionCaseId)
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  essayId?: string;

  @ApiPropertyOptional({
    description:
      'Which paragraph (0-indexed) of the essay this debate is scoped to. Null = whole essay.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  paragraphIndex?: number;

  @ApiProperty({
    description: "The user's argument back against the AI feedback.",
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  userText!: string;
}
