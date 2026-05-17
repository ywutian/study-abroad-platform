import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

/**
 * Toggles whether the current user accepts Hall peer reviews
 * (校友广场锐评隐私开关). Maps to `User.acceptPeerReview`.
 */
export class UpdatePeerReviewSettingDto {
  @ApiProperty({
    description:
      'Whether the user accepts receiving peer reviews in the Alumni Square',
  })
  @IsBoolean()
  acceptPeerReview: boolean;
}
