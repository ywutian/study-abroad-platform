import { validate } from 'class-validator';
import type { NextFunction, Request, Response } from 'express';

import { ChatDto } from '../dto';
import type { AuditService } from '../security/audit.service';
import type { PromptGuardService } from '../security/prompt-guard.service';
import { AgentSecurityMiddleware } from './security.middleware';

describe('AgentSecurityMiddleware', () => {
  it('replaces sanitized input without adding a DTO-unknown request field', async () => {
    const promptGuard = {
      analyze: jest.fn().mockResolvedValue({
        safe: true,
        riskScore: 0,
        threats: [],
        blocked: false,
        sanitizedInput: 'sanitized input',
      }),
    } as unknown as PromptGuardService;
    const auditService = { log: jest.fn() } as unknown as AuditService;
    const middleware = new AgentSecurityMiddleware(promptGuard, auditService);
    const request = {
      body: { message: '<synthetic_context>safe input</synthetic_context>' },
    } as Request;
    const next = jest.fn() as NextFunction;

    await middleware.use(request, {} as Response, next);

    expect(request.body).toEqual({ message: 'sanitized input' });
    const dto = Object.assign(new ChatDto(), request.body);
    await expect(
      validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).resolves.toHaveLength(0);
    expect(next).toHaveBeenCalledWith();
  });
});
