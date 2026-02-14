import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VaultController } from './vault.controller';
import { VaultService } from './vault.service';
import { EncryptionService } from './encryption.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [PrismaModule, ConfigModule, UserModule],
  controllers: [VaultController],
  providers: [VaultService, EncryptionService],
  exports: [VaultService, EncryptionService],
})
export class VaultModule {}
