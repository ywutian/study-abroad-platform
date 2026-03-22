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
  // Standalone 组队
  TEAM_CREATE = 'TEAM_CREATE',
  TEAM_DISBAND = 'TEAM_DISBAND',
  TEAM_INVITE = 'TEAM_INVITE',
  TEAM_LEAVE = 'TEAM_LEAVE',
  TEAM_MEMBER_REMOVE = 'TEAM_MEMBER_REMOVE',
  TEAM_TRANSFER_OWNER = 'TEAM_TRANSFER_OWNER',
  TEAM_ACCEPT_INVITE = 'TEAM_ACCEPT_INVITE',
  // Data review system
  CASE_REVIEW_APPROVED = 'CASE_REVIEW_APPROVED',
  CASE_REVIEW_REJECTED = 'CASE_REVIEW_REJECTED',
  CASE_BATCH_IMPORTED = 'CASE_BATCH_IMPORTED',
  CASE_BATCH_ROLLBACK = 'CASE_BATCH_ROLLBACK',
  STAGING_APPROVED = 'STAGING_APPROVED',
  STAGING_REJECTED = 'STAGING_REJECTED',
  // Role management
  ROLE_CHANGE = 'ROLE_CHANGE',
  PERMISSION_UPDATE = 'PERMISSION_UPDATE',
  // High school evaluation
  HIGH_SCHOOL_EVALUATED = 'HIGH_SCHOOL_EVALUATED',
  HIGH_SCHOOL_APPROVED = 'HIGH_SCHOOL_APPROVED',
  HIGH_SCHOOL_CALIBRATED = 'HIGH_SCHOOL_CALIBRATED',
  HIGH_SCHOOL_TIER_CHANGED = 'HIGH_SCHOOL_TIER_CHANGED',
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    userId: string;
    action: AuditAction;
    resource?: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
    ip?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: params.userId,
          action: params.action,
          resource: params.resource ?? 'general',
          resourceId: params.resourceId ?? null,
          metadata: (params.metadata ?? undefined) as any,
          ipAddress: params.ip ?? null,
          userAgent: params.userAgent ?? null,
        },
      });
      this.logger.debug(
        `AUDIT: ${params.action} by user ${params.userId}` +
          (params.resource ? ` on ${params.resource}` : ''),
      );
    } catch (error) {
      this.logger.error('Failed to write audit log', error);
    }
  }
}
