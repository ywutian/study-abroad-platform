import { BadRequestException } from '@nestjs/common';
import { AgentType } from '../types';
import { AgentSkillPolicyService } from './agent-skill-policy.service';

describe('AgentSkillPolicyService', () => {
  const service = new AgentSkillPolicyService();

  it('captures the existing Agent tool boundary as the baseline', () => {
    const skill = service.bootstrap(AgentType.SCHOOL);
    expect(skill.allowedTools).toContain('search_schools');
    expect(skill.allowedTools).toContain('analyze_admission_chance');
    expect(service.validate(skill)).toEqual(skill);
  });

  it('allows a candidate to reduce its parent tool set', () => {
    const parent = service.bootstrap(AgentType.PROFILE);
    const candidate = service.mergeCandidate(parent, {
      allowedTools: parent.allowedTools.filter(
        (tool) => tool !== 'update_profile',
      ),
    });
    expect(candidate.allowedTools).not.toContain('update_profile');
  });

  it('never allows a candidate to add or regain a tool permission', () => {
    const base = service.bootstrap(AgentType.PROFILE);
    expect(() =>
      service.mergeCandidate(base, {
        allowedTools: [...base.allowedTools, 'web_search'],
      }),
    ).toThrow(BadRequestException);

    const reduced = service.mergeCandidate(base, {
      allowedTools: base.allowedTools.filter(
        (tool) => tool !== 'update_profile',
      ),
    });
    expect(() =>
      service.mergeCandidate(reduced, { allowedTools: base.allowedTools }),
    ).toThrow(/cannot add or regain/);
  });

  it('rejects executable and secret-like Skill content', () => {
    const base = service.bootstrap(AgentType.ESSAY);
    expect(() =>
      service.mergeCandidate(base, {
        instructions: { en: ['```bash\nrm -rf /\n```'] },
      }),
    ).toThrow(/executable or secret-like/);
    expect(() =>
      service.mergeCandidate(base, {
        instructions: { en: ['api_key=do-not-store-this'] },
      }),
    ).toThrow(/executable or secret-like/);
  });

  it('creates a stable hash for the same declarative content', () => {
    const first = service.bootstrap(AgentType.TIMELINE);
    const second = JSON.parse(JSON.stringify(first));
    expect(service.hash(first)).toBe(service.hash(second));
  });
});
