import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { createHash } from 'crypto';
import { AGENT_CONFIGS } from '../config/agents.config';
import { TOOLS } from '../config/tools.config';
import { AgentType } from '../types';
import type { AgentConfig } from '../types';
import { ConfigValidatorService } from '../config/config-validator.service';
import {
  AGENT_SKILL_SCHEMA_VERSION,
  AgentSkillCandidatePatch,
  DeclarativeAgentSkill,
} from './agent-skill.types';

const MAX_INSTRUCTIONS = 24;
const MAX_EXAMPLES = 8;
const MAX_WORKFLOW_STEPS = 16;
const MAX_TEXT_LENGTH = 2_000;
const BLOCKED_TEXT = [
  /```\s*(?:js|jsx|ts|tsx|python|py|sh|bash|zsh|powershell)/i,
  /\b(?:child_process|process\.env|eval\s*\(|exec\s*\(|spawn\s*\(|require\s*\()/i,
  /\b(?:rm\s+-rf|curl\s+[^\n]*\|\s*(?:sh|bash)|chmod\s+777)\b/i,
  /\b(?:api[_-]?key|access[_-]?token|private[_-]?key|client[_-]?secret)\s*[:=]/i,
];

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

@Injectable()
export class AgentSkillPolicyService {
  private readonly registeredTools = new Set(TOOLS.map((tool) => tool.name));

  constructor(
    @Optional() private readonly configValidator?: ConfigValidatorService,
  ) {}

  getBaseConfig(agentType: AgentType): AgentConfig {
    const validated = this.configValidator?.getValidatedConfig(agentType);
    return validated ?? AGENT_CONFIGS[agentType];
  }

  bootstrap(agentType: AgentType): DeclarativeAgentSkill {
    return {
      schemaVersion: AGENT_SKILL_SCHEMA_VERSION,
      agentType,
      instructions: { zh: [], en: [] },
      examples: [],
      toolHints: {},
      allowedTools: [...this.getBaseConfig(agentType).tools],
      outputRules: {},
      workflowTemplate: [],
    };
  }

  apply(base: AgentConfig, skill: DeclarativeAgentSkill): AgentConfig {
    const render = (title: string, instructions: string[]) => {
      const sections = [
        ...instructions,
        ...skill.workflowTemplate.map((step, index) => `${index + 1}. ${step}`),
        ...Object.entries(skill.toolHints).map(
          ([tool, hint]) => `${tool}: ${hint}`,
        ),
        ...(skill.outputRules.requiredSections ?? []).map(
          (item) => `Required section: ${item}`,
        ),
        ...(skill.outputRules.requiredJsonFields ?? []).map(
          (item) => `Required JSON field: ${item}`,
        ),
        ...(skill.outputRules.forbiddenClaims ?? []).map(
          (item) => `Forbidden claim: ${item}`,
        ),
      ];
      return sections.length > 0
        ? `\n\n## ${title}\n${sections.map((item) => `- ${item}`).join('\n')}`
        : '';
    };
    return {
      ...base,
      systemPrompt: `${base.systemPrompt}${render('声明式 Skill', skill.instructions.zh)}`,
      systemPromptEn: `${base.systemPromptEn ?? base.systemPrompt}${render('Declarative Skill', skill.instructions.en)}`,
      tools: base.tools.filter((tool) => skill.allowedTools.includes(tool)),
    };
  }

  mergeCandidate(
    parent: DeclarativeAgentSkill,
    patch: AgentSkillCandidatePatch,
  ): DeclarativeAgentSkill {
    const unknown = Object.keys(patch).filter(
      (key) =>
        ![
          'instructions',
          'examples',
          'toolHints',
          'allowedTools',
          'outputRules',
          'workflowTemplate',
        ].includes(key),
    );
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Skill fields are not evolvable: ${unknown.join(', ')}`,
      );
    }

    return this.validate(
      {
        ...parent,
        ...patch,
        schemaVersion: AGENT_SKILL_SCHEMA_VERSION,
        agentType: parent.agentType,
        instructions: {
          zh: this.unique([
            ...parent.instructions.zh,
            ...(patch.instructions?.zh ?? []),
          ]),
          en: this.unique([
            ...parent.instructions.en,
            ...(patch.instructions?.en ?? []),
          ]),
        },
        examples: patch.examples
          ? this.uniqueObjects([...parent.examples, ...patch.examples])
          : parent.examples,
        toolHints: { ...parent.toolHints, ...(patch.toolHints ?? {}) },
        workflowTemplate: patch.workflowTemplate
          ? this.unique([...parent.workflowTemplate, ...patch.workflowTemplate])
          : parent.workflowTemplate,
        outputRules: {
          ...parent.outputRules,
          ...(patch.outputRules ?? {}),
        },
      },
      parent,
    );
  }

  validate(
    input: DeclarativeAgentSkill,
    parent?: DeclarativeAgentSkill,
  ): DeclarativeAgentSkill {
    if (input.schemaVersion !== AGENT_SKILL_SCHEMA_VERSION) {
      throw new BadRequestException('Unsupported Skill schema version');
    }
    if (!Object.values(AgentType).includes(input.agentType)) {
      throw new BadRequestException('Unknown Agent type');
    }

    this.assertStringList(
      'instructions.zh',
      input.instructions?.zh,
      MAX_INSTRUCTIONS,
    );
    this.assertStringList(
      'instructions.en',
      input.instructions?.en,
      MAX_INSTRUCTIONS,
    );
    this.assertStringList(
      'workflowTemplate',
      input.workflowTemplate,
      MAX_WORKFLOW_STEPS,
    );
    this.assertStringList(
      'outputRules.requiredSections',
      input.outputRules?.requiredSections ?? [],
      16,
    );
    this.assertStringList(
      'outputRules.requiredJsonFields',
      input.outputRules?.requiredJsonFields ?? [],
      32,
    );
    this.assertStringList(
      'outputRules.forbiddenClaims',
      input.outputRules?.forbiddenClaims ?? [],
      32,
    );

    if (
      !Array.isArray(input.examples) ||
      input.examples.length > MAX_EXAMPLES
    ) {
      throw new BadRequestException(
        `Skill examples must contain at most ${MAX_EXAMPLES} items`,
      );
    }
    for (const example of input.examples) {
      this.assertSafeText('example.input', example?.input);
      this.assertSafeText('example.output', example?.output);
    }

    if (
      !input.toolHints ||
      Array.isArray(input.toolHints) ||
      typeof input.toolHints !== 'object'
    ) {
      throw new BadRequestException('Skill toolHints must be an object');
    }
    for (const [tool, hint] of Object.entries(input.toolHints)) {
      if (!input.allowedTools.includes(tool)) {
        throw new BadRequestException(
          `Tool hint is outside the Skill tool set: ${tool}`,
        );
      }
      this.assertSafeText(`toolHints.${tool}`, hint);
    }

    const baseTools = new Set(this.getBaseConfig(input.agentType).tools);
    const parentTools = new Set(parent?.allowedTools ?? baseTools);
    if (
      !Array.isArray(input.allowedTools) ||
      new Set(input.allowedTools).size !== input.allowedTools.length
    ) {
      throw new BadRequestException('Skill tools must be a unique array');
    }
    for (const tool of input.allowedTools) {
      if (
        !this.registeredTools.has(tool) ||
        !baseTools.has(tool) ||
        !parentTools.has(tool)
      ) {
        throw new BadRequestException(
          `Skill cannot add or regain tool permission: ${tool}`,
        );
      }
    }

    return JSON.parse(JSON.stringify(input)) as DeclarativeAgentSkill;
  }

  hash(skill: DeclarativeAgentSkill): string {
    return createHash('sha256')
      .update(JSON.stringify(canonicalize(skill)))
      .digest('hex');
  }

  private assertStringList(
    label: string,
    value: unknown,
    maxItems: number,
  ): asserts value is string[] {
    if (!Array.isArray(value) || value.length > maxItems) {
      throw new BadRequestException(
        `${label} must contain at most ${maxItems} items`,
      );
    }
    for (const item of value) this.assertSafeText(label, item);
  }

  private assertSafeText(
    label: string,
    value: unknown,
  ): asserts value is string {
    if (
      typeof value !== 'string' ||
      value.length === 0 ||
      value.length > MAX_TEXT_LENGTH
    ) {
      throw new BadRequestException(
        `${label} must be 1-${MAX_TEXT_LENGTH} characters`,
      );
    }
    if (BLOCKED_TEXT.some((pattern) => pattern.test(value))) {
      throw new BadRequestException(
        `${label} contains executable or secret-like content`,
      );
    }
  }

  private unique(values: string[]): string[] {
    return [...new Set(values)];
  }

  private uniqueObjects<T>(values: T[]): T[] {
    const seen = new Set<string>();
    return values.filter((value) => {
      const key = JSON.stringify(canonicalize(value));
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
