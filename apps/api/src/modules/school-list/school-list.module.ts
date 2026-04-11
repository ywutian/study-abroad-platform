import { Module } from '@nestjs/common';
import { SchoolListController } from './school-list.controller';
import { SchoolListService } from './school-list.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [SchoolListController],
  providers: [SchoolListService],
  exports: [SchoolListService],
})
export class SchoolListModule {}
