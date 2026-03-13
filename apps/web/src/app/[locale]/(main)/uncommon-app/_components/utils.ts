import { apiClient } from '@/lib/api';
import { AI_TIMEOUTS } from '@/lib/constants';
import type {
  AgentType,
  AgentResponse,
  TieredRecommendations,
  SchoolRecommendation,
} from './types';

/**
 * Call the AI agent endpoint with extended timeout.
 */
export async function callAIAgent(
  agent: AgentType,
  message: string,
  conversationId?: string
): Promise<AgentResponse> {
  const response = await apiClient.post<AgentResponse>(
    '/ai-agent/agent',
    {
      agent,
      message,
      conversationId,
    },
    {
      timeout: AI_TIMEOUTS.AI_REQUEST,
    }
  );
  return response;
}

/**
 * Extract a numeric score from AI text (e.g. "85/100" or "8.5/10").
 */
export function extractScore(text: string): number | null {
  const scoreMatch = text.match(/(\d{1,3}(?:\.\d)?)\s*[/]\s*(?:100|10)/);
  if (scoreMatch) {
    const score = parseFloat(scoreMatch[1]);
    return score > 10 ? Math.min(100, Math.round(score)) : Math.min(100, Math.round(score * 10));
  }
  const boldMatch = text.match(/\*\*(\d{1,3}(?:\.\d)?)\s*[/]\s*(?:100|10)\*\*/);
  if (boldMatch) {
    const score = parseFloat(boldMatch[1]);
    return score > 10 ? Math.min(100, Math.round(score)) : Math.min(100, Math.round(score * 10));
  }
  return null;
}

/**
 * Parse structured sections from a markdown AI response.
 */
export function parseMarkdownSections(text: string): {
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  activities: string[];
} {
  const lines = text.split('\n');
  const sections: Record<string, string[]> = {
    strengths: [],
    weaknesses: [],
    improvements: [],
    activities: [],
  };

  let currentSection: keyof typeof sections | null = null;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.match(/^#{1,3}\s*\d*\)?\s*优势/i)) {
      currentSection = 'strengths';
      continue;
    }
    if (trimmedLine.match(/^#{1,3}\s*\d*\)?\s*(不足|劣势|弱点|待提升)/i)) {
      currentSection = 'weaknesses';
      continue;
    }
    if (trimmedLine.match(/^#{1,3}\s*\d*\)?\s*(提升|建议|改进)/i)) {
      currentSection = 'improvements';
      continue;
    }
    if (trimmedLine.match(/^#{1,3}\s*\d*\)?\s*(推荐活动|活动建议|推荐)/i)) {
      currentSection = 'activities';
      continue;
    }
    if (trimmedLine.match(/^#{1,3}\s*\d*\)?\s*(整体|评分|预计|时间|总结)/i)) {
      currentSection = null;
      continue;
    }

    if (currentSection && trimmedLine.startsWith('-')) {
      const item = trimmedLine.replace(/^-\s*/, '').replace(/\*\*/g, '').trim();

      if (item.length > 2) {
        sections[currentSection].push(item);
      }
    }
  }

  return {
    strengths: sections.strengths.slice(0, 8),
    weaknesses: sections.weaknesses.slice(0, 8),
    improvements: sections.improvements.slice(0, 8),
    activities: sections.activities.slice(0, 8),
  };
}

/**
 * Parse school recommendations from AI text response.
 * Tries JSON first, falls back to line-by-line text parsing.
 */
export function parseSchoolRecommendations(text: string): TieredRecommendations {
  const result: TieredRecommendations = { safety: [], target: [], reach: [] };

  // Try extracting a JSON block first
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      const jsonData = JSON.parse(jsonMatch[1].trim());
      if (jsonData.schools && Array.isArray(jsonData.schools)) {
        for (const school of jsonData.schools as SchoolRecommendation[]) {
          const tier = (school.tier ?? school.fit ?? '').toLowerCase();
          if (tier === 'reach') {
            result.reach.push(school);
          } else if (tier === 'target' || tier === 'match') {
            result.target.push(school);
          } else if (tier === 'safety') {
            result.safety.push(school);
          }
        }
        if (result.reach.length || result.target.length || result.safety.length) {
          return result;
        }
      }
    } catch (_e) {
      console.warn('Failed to parse JSON from AI response:', _e);
    }
  }

  // Fallback: line-by-line parsing
  const reachPatterns = [/冲刺校|Reach|reach|冲刺/i];
  const targetPatterns = [/匹配校|Target|target|匹配/i];
  const safetyPatterns = [/保底校|Safety|safety|保底/i];

  const lines = text.split('\n');
  let currentTier: 'reach' | 'target' | 'safety' | null = null;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (reachPatterns.some((p) => p.test(trimmedLine))) {
      currentTier = 'reach';
      continue;
    }
    if (targetPatterns.some((p) => p.test(trimmedLine))) {
      currentTier = 'target';
      continue;
    }
    if (safetyPatterns.some((p) => p.test(trimmedLine))) {
      currentTier = 'safety';
      continue;
    }

    if (currentTier && trimmedLine) {
      const listMatch = trimmedLine.match(/^[-•*\d.)\]]\s*\*{0,2}(.+?)\*{0,2}(?:\s*[-–:]|$)/);
      if (listMatch) {
        const schoolName = listMatch[1].trim().replace(/\*+/g, '');
        if (
          schoolName &&
          schoolName.length > 1 &&
          !schoolName.match(/^(冲刺|匹配|保底|Reach|Target|Safety)/i)
        ) {
          result[currentTier].push({ name: schoolName, nameZh: schoolName });
        }
      } else if (
        !trimmedLine.match(/^#+\s/) &&
        !trimmedLine.match(/^(冲刺|匹配|保底|Reach|Target|Safety)/i)
      ) {
        const schoolName = trimmedLine.replace(/\*+/g, '').trim();
        if (schoolName && schoolName.length > 2 && schoolName.length < 50) {
          result[currentTier].push({ name: schoolName, nameZh: schoolName });
        }
      }
    }
  }

  return result;
}
