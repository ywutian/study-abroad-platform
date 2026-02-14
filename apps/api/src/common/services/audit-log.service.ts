import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export enum AuditAction {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  PASSWORD_RESET = 'PASSWORD_RESET',
  VAULT_ACCESS = 'VAULT_ACCESS',
  VAULT_EXPORT = 'VAULT_EXPORT',
  ADMIN_ACTION = 'ADMIN_ACTION',
  DATA_EXPORT = 'DATA_EXPORT',
  ACCOUNT_DELETE = 'ACCOUNT_DELETE',
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    userId: string;
    action: AuditAction;
    resource?: string;
    metadata?: Record<string, any>;
    ip?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      this.logger.log(
        `AUDIT: ${params.action} by user ${params.userId}` +
          (params.resource ? ` on ${params.resource}` : ''),
      );
      // TODO: Store in AuditLog table when schema is ready
      // For now, structured logging provides the audit trail
    } catch (error) {
      this.logger.error('Failed to write audit log', error);
    }
  }
}
