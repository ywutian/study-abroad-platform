/**
 * 安全中间件
 *
 * 集成安全检查到请求处理流程：
 * 1. 输入检查
 * 2. 限流
 * 3. 审计
 */

import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PromptGuardService } from '../security/prompt-guard.service';
import {
  AuditService,
  AuditAction,
  AuditStatus,
} from '../security/audit.service';

@Injectable()
export class AgentSecurityMiddleware implements NestMiddleware {
  constructor(
    private promptGuard: PromptGuardService,
    private auditService: AuditService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const userId = (req as any).user?.id;
    const startTime = Date.now();

    try {
      // 检查请求体中的消息内容
      const message = req.body?.message || req.body?.content;

      if (message && typeof message === 'string') {
        const guardResult = await this.promptGuard.analyze(message, {
          userId,
          strictMode: false,
        });

        if (guardResult.blocked) {
          // 记录安全事件
          await this.auditService.log({
            action: AuditAction.SECURITY_BLOCK,
            resource: 'agent',
            operation: 'EXECUTE',
            status: AuditStatus.DENIED,
            details: {
              reason: guardResult.reason,
              riskScore: guardResult.riskScore,
              threats: guardResult.threats.map((t) => t.type),
            },
            duration: Date.now() - startTime,
          });

          throw new HttpException(
            {
              statusCode: HttpStatus.BAD_REQUEST,
              message: '输入内容包含不安全的模式',
              code: 'SECURITY_BLOCK',
            },
            HttpStatus.BAD_REQUEST,
          );
        }

        // 如果有清洗后的输入，替换原始输入
        if (
          guardResult.sanitizedInput &&
          guardResult.sanitizedInput !== message
        ) {
          req.body.message = guardResult.sanitizedInput;
          req.body._originalMessage = message;
        }
      }

      next();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      next(error);
    }
  }
}
