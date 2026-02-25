import type { ResumeSettings } from '@study-abroad/shared';
import type { TemplateDefinition, TemplateCategory, ResumeTheme, LayoutType } from '../types';
import { TEMPLATE_DEFINITIONS } from './definitions';
import { buildTheme } from '../themes';
import { applyUserSettings } from '../themes/apply-settings';

// ─── Template Registry ───

const templateMap = new Map<string, TemplateDefinition>();
for (const t of TEMPLATE_DEFINITIONS) {
  templateMap.set(t.id, t);
}

export function getTemplate(id: string): TemplateDefinition {
  return templateMap.get(id) ?? TEMPLATE_DEFINITIONS[0]; // fallback to jake-classic
}

export function getAllTemplates(): TemplateDefinition[] {
  return TEMPLATE_DEFINITIONS;
}

export function getTemplatesByCategory(category: TemplateCategory): TemplateDefinition[] {
  return TEMPLATE_DEFINITIONS.filter((t) => t.category === category);
}

export function getTemplatesForResumeType(resumeType: string): TemplateDefinition[] {
  return TEMPLATE_DEFINITIONS.filter((t) => t.recommendedFor.includes(resumeType));
}

/**
 * Resolves a template ID into a full ResumeTheme + LayoutType.
 * Three-layer cascade: base theme → template overrides → user settings.
 */
export function resolveTemplate(
  templateId: string,
  userSettings?: ResumeSettings
): {
  theme: ResumeTheme;
  layout: LayoutType;
  definition: TemplateDefinition;
} {
  const def = getTemplate(templateId);
  const theme = buildTheme(def.theme, def.fontPairing, def.overrides);
  return {
    theme: userSettings ? applyUserSettings(theme, userSettings) : theme,
    layout: def.layout,
    definition: def,
  };
}
