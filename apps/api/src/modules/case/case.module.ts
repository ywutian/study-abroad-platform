import { Module } from '@nestjs/common';
import { CaseService } from './case.service';
import { CaseController } from './case.controller';

@Module({
  controllers: [CaseController],
  providers: [CaseService],
  exports: [CaseService],
})
export class CaseModule {}

