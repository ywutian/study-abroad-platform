import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminDataSyncService } from './admin-data-sync.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { SchoolModule } from '../school/school.module';

@Module({
  imports: [PrismaModule, NotificationModule, SchoolModule],
  controllers: [AdminController],
  providers: [AdminService, AdminDataSyncService],
  exports: [AdminService],
})
export class AdminModule {}
