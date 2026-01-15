import { Module } from '@nestjs/common';
import { PeerReviewService } from './peer-review.service';
import { PeerReviewController } from './peer-review.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [PeerReviewService],
  controllers: [PeerReviewController],
  exports: [PeerReviewService],
})
export class PeerReviewModule {}
