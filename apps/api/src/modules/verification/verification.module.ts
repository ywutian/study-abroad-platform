import { Module } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { VerificationController } from './verification.controller';
import { CaseModule } from '../case/case.module';

@Module({
  imports: [CaseModule],
  controllers: [VerificationController],
  providers: [VerificationService],
  exports: [VerificationService],
})
export class VerificationModule {}
