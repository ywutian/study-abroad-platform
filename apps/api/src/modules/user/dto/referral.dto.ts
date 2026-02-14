import { ApiProperty } from '@nestjs/swagger';

export class ReferralCodeResponseDto {
  @ApiProperty({ description: 'Unique referral code' })
  referralCode: string;

  @ApiProperty({ description: 'Full referral link' })
  referralLink: string;

  @ApiProperty({ description: 'Number of users referred' })
  referralCount: number;

  @ApiProperty({ description: 'Total points earned from referrals' })
  totalPointsEarned: number;
}

export class ReferredUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  joinedAt: Date;

  @ApiProperty()
  pointsEarned: number;
}

export class ReferralListResponseDto {
  @ApiProperty({ type: [ReferredUserDto] })
  referrals: ReferredUserDto[];

  @ApiProperty()
  total: number;
}
