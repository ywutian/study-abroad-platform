/**
 * Tool Handler Interface
 *
 * Each domain tool service implements this interface to register
 * its tool handlers with the ToolExecutorService.
 */

export type ToolHandler = (
  args: ToolArguments,
  userId: string,
  context: ToolContext,
  locale: string,
) => Promise<unknown>;

export interface ToolArguments {
  aspects?: string;
  background?: string;
  caseId?: string;
  category?: string;
  content?: string;
  context?: string;
  count?: number;
  deadline?: string;
  description?: string;
  essayId?: string;
  eventDate?: string;
  field?: string;
  forceRefresh?: boolean;
  gpaRange?: string;
  includeRejected?: boolean;
  itemId?: string;
  limit?: number;
  major?: string;
  nationality?: string;
  preference?: string;
  prompt?: string;
  query?: string;
  question?: string;
  resultId?: string;
  resumeId?: string;
  round?: string;
  schoolId?: string;
  schoolIds?: string;
  schoolName?: string;
  sectionId?: string;
  sectionType?: string;
  startDate?: string;
  style?: string;
  targetMajor?: string;
  targetSchool?: string;
  targetSchools?: string;
  targetTier?: string;
  timeRange?: string;
  title?: string;
  topic?: string;
  type?: string;
  value?: string;
  wordLimit?: number;
  year?: number;
}

export interface ToolContext {
  profile?: unknown;
  preferences?: unknown;
  currentGoals?: string[];
  recentActions?: string[];
  [key: string]: unknown;
}

export interface IToolHandlerProvider {
  getHandlers(): Map<string, ToolHandler>;
}
