import { Module } from '@nestjs/common';
import { SchoolListController } from './school-list.controller';
import { SchoolListService } from './school-list.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SchoolListController],
  providers: [SchoolListService],
  exports: [SchoolListService],
})
export class SchoolListModule {}
