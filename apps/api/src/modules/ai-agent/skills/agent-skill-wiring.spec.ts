import { MODULE_METADATA } from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AiAgentModule } from '../ai-agent.module';
import { AgentSecurityModule } from '../security/security.module';
import { AlertChannelService } from '../infrastructure/alerting/alert-channel.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AgentEvaluationTraceService } from '../core/agent-evaluation-trace.service';
import { AgentSkillSignalCollector } from './agent-skill-signal-collector.service';
import { AgentSkillMonitorService } from './agent-skill-monitor.service';
import { AgentSkillService } from './agent-skill.service';

describe('Skill reliability module wiring', () => {
  it('registers the collector and monitor and injects the monitor into Trace', async () => {
    const providers: unknown[] = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      AiAgentModule,
    );
    const exports: unknown[] = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      AgentSecurityModule,
    );
    const services = [
      AgentEvaluationTraceService,
      AgentSkillSignalCollector,
      AgentSkillMonitorService,
    ];
    for (const service of services) expect(providers).toContain(service);
    expect(exports).toContain(AlertChannelService);
    const prisma = {
      agentSkillDeployment: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const module = await Test.createTestingModule({
      providers: [
        ...services,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: new ConfigService({ AI_AGENT_SKILLS_EVOLUTION_V1: 'true' }),
        },
        {
          provide: AgentSkillService,
          useValue: { isEvolutionEnabled: () => true },
        },
        { provide: AlertChannelService, useValue: { send: jest.fn() } },
      ],
    }).compile();
    try {
      await module.init(); // fails if the safety monitor silently becomes undefined
      await module.get(AgentSkillMonitorService).onSafetyTrace('school', 'v2');
      expect(prisma.agentSkillDeployment.findMany).toHaveBeenCalled();
    } finally {
      await module.close();
    }
  });
});
