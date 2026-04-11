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
      directApi: true,
    }
  );
  return response;
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
      // JSON parsing failed, fall through to line-by-line parsing
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
