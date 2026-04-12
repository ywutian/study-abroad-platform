# Feature: Profile AI Analysis

## Purpose

AI-generated comprehensive application analysis based on user profile and target schools.

## Components

- ProfileAIAnalysis — full analysis display with section breakdowns, strengths/weaknesses, and improvement suggestions

## Data Flow

- API: `GET /profiles/me/ai-analysis`
- Types from `@study-abroad/shared`: AIAnalysisResult, SectionAnalysis, AnalysisState
- useMutation for triggering re-analysis, useQuery for fetching cached results

## Patterns

- Structured rendering of AIAnalysisResult contract (no markdown parsing)
- Feedback buttons per analysis section (ApplicationAnalysisFeedbackCategory)
- Experiment capability flags (ApplicationAnalysisExperimentCapability)
- Unit tested (ProfileAIAnalysis.test.tsx)
