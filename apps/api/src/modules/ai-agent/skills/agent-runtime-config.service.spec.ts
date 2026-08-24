import { Test } from '@nestjs/testing';
import { AgentType } from '../types';
import { AgentRuntimeConfigService } from './agent-runtime-config.service';
import { AgentSkillService } from './agent-skill.service';

describe('AgentRuntimeConfigService', () => {
  it('resolves the Skill version pinned to the run', async () => {
    const config = {
      type: AgentType.SCHOOL,
      name: 'School Recommendation',
      description: 'test',
      systemPrompt: 'test',
      tools: ['searchSchools'],
      temperature: 0,
      maxTokens: 100,
    };
    const resolveForRun = jest.fn().mockResolvedValue({
      config,
      versionId: 'skill-version-1',
    });
    const module = await Test.createTestingModule({
      providers: [
        AgentRuntimeConfigService,
        { provide: AgentSkillService, useValue: { resolveForRun } },
      ],
    }).compile();

    await expect(
      module.get(AgentRuntimeConfigService).resolve(AgentType.SCHOOL, 'run-1'),
    ).resolves.toBe(config);
    expect(resolveForRun).toHaveBeenCalledWith(AgentType.SCHOOL, 'run-1');
  });
});
