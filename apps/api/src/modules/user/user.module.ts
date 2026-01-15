import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { DashboardService } from './dashboard.service';
import { CaseModule } from '../case/case.module';

@Module({
  imports: [CaseModule],
  controllers: [UserController],
  providers: [UserService, DashboardService],
  exports: [UserService, DashboardService],
})
export class UserModule {}
