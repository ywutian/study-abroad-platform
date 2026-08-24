import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

function decodeManagedPasswordHash(encoded: string): string {
  const passwordHash = Buffer.from(encoded, 'base64').toString('utf8');
  if (!/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(passwordHash)) {
    throw new InternalServerErrorException(
      'ADMIN_BOOTSTRAP_PASSWORD_HASH_B64 is not a bcrypt hash',
    );
  }
  return passwordHash;
}

/**
 * Production-only reconciliation for the managed administrator credential.
 * Runtime receives only a one-way bcrypt hash. The plaintext password remains
 * in GitHub Actions secrets for production acceptance and is never injected
 * into Cloud Run or logged.
 */
@Injectable()
export class AdminBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.config.get<string>('NODE_ENV') !== 'production') return;
    const email = this.config.get<string>('ADMIN_BOOTSTRAP_EMAIL');
    const encodedHash = this.config.get<string>(
      'ADMIN_BOOTSTRAP_PASSWORD_HASH_B64',
    );
    if (!email || !encodedHash) return;
    const passwordHash = decodeManagedPasswordHash(encodedHash);

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (!existing) {
      await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            passwordHash,
            emailVerified: true,
            role: Role.SUPER_ADMIN,
            locale: 'zh',
          },
        });
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'ADMIN_BOOTSTRAP_CREATED',
            resource: 'auth',
            resourceId: user.id,
            metadata: { source: 'github_actions_bcrypt_hash' },
          },
        });
      });
      this.logger.log(
        'Production administrator bootstrapped from managed password hash',
      );
      return;
    }

    if (existing.passwordHash === passwordHash) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: existing.id },
        data: { passwordHash },
      });
      await tx.refreshToken.deleteMany({ where: { userId: existing.id } });
      await tx.auditLog.create({
        data: {
          userId: existing.id,
          action: 'ADMIN_BOOTSTRAP_CREDENTIAL_RECONCILED',
          resource: 'auth',
          resourceId: existing.id,
          metadata: {
            refreshTokensRevoked: true,
            source: 'github_actions_bcrypt_hash',
          },
        },
      });
    });
    this.logger.warn(
      'Production administrator credential was reconciled with managed password hash',
    );
  }
}
