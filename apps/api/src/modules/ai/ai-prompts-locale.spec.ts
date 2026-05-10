import { AgentType } from '../ai-agent/types';
import {
  getAgentConfig,
  getLocalizedSystemPrompt,
} from '../ai-agent/config/agents.config';
import {
  buildBrainstormSystemPrompt,
  buildContinueWritingSystemPrompt,
  buildParagraphAnalysisSystemPrompt,
  buildPolishEssaySystemPrompt,
  buildPolishEssayUserPrompt,
  buildReviewSystemPrompt,
  buildRewriteParagraphSystemPrompt,
} from '../essay/essay-ai.prompts';
import {
  buildActivitySortSystemPrompt,
  buildProfileAnalysisSystemPrompt,
} from './profile-ai.prompts';
import { buildResumeReviewSystemPrompt } from './resume-ai.prompts';
import { buildStableSystemPrompt } from '../prediction/prediction.prompts';
import { buildRecommendationSystemPrompt } from '../recommendation/recommendation.prompts';
import { buildApplicationAnalysisSystemPrompt } from '../profile/profile-application-analysis.prompts';
import {
  buildPortfolioSystemPrompt,
  buildSchoolAnalystSystemPrompt,
} from '../profile/profile-application-analysis-v2.prompts';
import { buildRankingAnalysisSystemPrompt } from '../hall/hall-ranking.prompts';

const CHINESE_TEXT = /[\u4e00-\u9fff]/;

function expectChinesePrompt(prompt: string) {
  expect(prompt).toMatch(CHINESE_TEXT);
}

function expectEnglishPrompt(prompt: string) {
  expect(prompt).not.toMatch(CHINESE_TEXT);
}

describe('AI prompt locale builders', () => {
  it('builds localized AI Agent system prompts', () => {
    const config = getAgentConfig(AgentType.ORCHESTRATOR);

    const zh = getLocalizedSystemPrompt(config, 'zh');
    const en = getLocalizedSystemPrompt(config, 'en');

    expectChinesePrompt(zh);
    expectEnglishPrompt(en);
    expect(zh).toContain('请使用中文回复用户');
    expect(en).toContain('Please respond in English');
  });

  it('builds localized essay prompts and preserves original content rules', () => {
    const zhPrompts = [
      buildReviewSystemPrompt('zh'),
      buildBrainstormSystemPrompt('zh'),
      buildRewriteParagraphSystemPrompt('zh', 'keep the first sentence'),
      buildContinueWritingSystemPrompt(
        'zh',
        'Describe a community you belong to.',
        'Use one concrete anecdote.',
      ),
      buildParagraphAnalysisSystemPrompt(
        'zh',
        'Describe a community you belong to.',
        'University of Michigan',
      ),
      buildPolishEssaySystemPrompt('zh', 'vivid'),
    ];

    const enPrompts = [
      buildReviewSystemPrompt('en'),
      buildBrainstormSystemPrompt('en'),
      buildRewriteParagraphSystemPrompt('en', 'keep the first sentence'),
      buildContinueWritingSystemPrompt(
        'en',
        'Describe a community you belong to.',
        'Use one concrete anecdote.',
      ),
      buildParagraphAnalysisSystemPrompt(
        'en',
        'Describe a community you belong to.',
        'University of Michigan',
      ),
      buildPolishEssaySystemPrompt('en', 'vivid'),
      buildPolishEssayUserPrompt('en', 'My essay draft.'),
    ];

    zhPrompts.forEach(expectChinesePrompt);
    enPrompts.forEach(expectEnglishPrompt);
    expect(buildRewriteParagraphSystemPrompt('zh')).toContain('Common App');
    expect(buildContinueWritingSystemPrompt('zh')).toContain('不翻译');
    expect(buildContinueWritingSystemPrompt('en')).toContain(
      'Do not translate',
    );
    expect(buildPolishEssayUserPrompt('en', 'My essay draft.')).toContain(
      'Please polish',
    );
  });

  it('builds localized prediction and recommendation prompts', () => {
    expectChinesePrompt(buildStableSystemPrompt('zh'));
    expectEnglishPrompt(buildStableSystemPrompt('en'));
    expectChinesePrompt(buildRecommendationSystemPrompt('zh', 6));
    expectEnglishPrompt(buildRecommendationSystemPrompt('en', 6));
  });

  it('builds localized profile analysis prompts', () => {
    expectChinesePrompt(buildProfileAnalysisSystemPrompt('zh'));
    expectEnglishPrompt(buildProfileAnalysisSystemPrompt('en'));
    expectChinesePrompt(buildApplicationAnalysisSystemPrompt('zh'));
    expectEnglishPrompt(buildApplicationAnalysisSystemPrompt('en'));
    expectChinesePrompt(buildSchoolAnalystSystemPrompt('zh'));
    expectEnglishPrompt(buildSchoolAnalystSystemPrompt('en'));
    expectChinesePrompt(buildPortfolioSystemPrompt('zh'));
    expectEnglishPrompt(buildPortfolioSystemPrompt('en'));
    expectChinesePrompt(buildActivitySortSystemPrompt('zh'));
    expectEnglishPrompt(buildActivitySortSystemPrompt('en'));
  });

  it('builds localized resume prompts while keeping ATS-style output rules explicit', () => {
    expectChinesePrompt(
      buildResumeReviewSystemPrompt('zh', 'COLLEGE_APPLICATION', false),
    );
    expectEnglishPrompt(
      buildResumeReviewSystemPrompt('en', 'COLLEGE_APPLICATION', false),
    );
    expect(buildResumeReviewSystemPrompt('zh', 'INTERNSHIP', false)).toContain(
      '所有文本必须用中文',
    );
    expect(buildResumeReviewSystemPrompt('en', 'INTERNSHIP', false)).toContain(
      'All text in English',
    );
  });

  it('builds localized hall ranking analysis prompts', () => {
    expectChinesePrompt(buildRankingAnalysisSystemPrompt('zh'));
    expectEnglishPrompt(buildRankingAnalysisSystemPrompt('en'));
    expect(buildRankingAnalysisSystemPrompt('zh')).toContain('GPA/SAT/ACT');
    expect(buildRankingAnalysisSystemPrompt('en')).toContain('JSON only');
  });
});
