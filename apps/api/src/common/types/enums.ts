/**
 * 共享枚举类型定义
 * 这些枚举在 Prisma schema 中定义但未被模型使用，因此需要在此手动定义
 */

// 任务类型
export enum TaskType {
  ESSAY = 'ESSAY',
  DOCUMENT = 'DOCUMENT',
  TEST = 'TEST',
  INTERVIEW = 'INTERVIEW',
  RECOMMENDATION = 'RECOMMENDATION',
  OTHER = 'OTHER',
}

// 保险库项目类型
export enum VaultItemType {
  PASSWORD = 'PASSWORD',
  CREDENTIAL = 'CREDENTIAL',
  DOCUMENT = 'DOCUMENT',
  NOTE = 'NOTE',
  API_KEY = 'API_KEY',
  OTHER = 'OTHER',
}

// 文书类型 (与 Prisma schema 保持一致)
export enum EssayType {
  COMMON_APP = 'COMMON_APP',
  UC = 'UC',
  MAIN = 'MAIN',
  SUPPLEMENTAL = 'SUPPLEMENTAL',
  SUPPLEMENT = 'SUPPLEMENT',
  WHY_SCHOOL = 'WHY_SCHOOL',
  WHY_US = 'WHY_US',
  SHORT_ANSWER = 'SHORT_ANSWER',
  ACTIVITY = 'ACTIVITY',
  OPTIONAL = 'OPTIONAL',
  OTHER = 'OTHER',
}

// 数据来源类型
export enum SourceType {
  OFFICIAL = 'OFFICIAL',
  COMMUNITY = 'COMMUNITY',
  AI_GENERATED = 'AI_GENERATED',
}

// 文书状态
export enum EssayStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

// 评估类型
export enum AssessmentType {
  HOLLAND = 'HOLLAND',
  MBTI = 'MBTI',
  STRENGTH = 'STRENGTH',
}
