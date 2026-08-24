import { Injectable } from '@nestjs/common';
import type { AgentConfig, AgentType } from '../types';
import { AgentSkillService } from './agent-skill.service';

@Injectable()
export class AgentRuntimeConfigService {
  constructor(private readonly skills: AgentSkillService) {}

  async resolve(agentType: AgentType, runId?: string): Promise<AgentConfig> {
    return (await this.skills.resolveForRun(agentType, runId)).config;
  }
}
