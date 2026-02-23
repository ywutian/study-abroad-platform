/**
 * Shared enums used across API, web, and mobile apps.
 * These enums are defined in the Prisma schema but not generated as types,
 * so they are maintained here as the single source of truth.
 */

export enum TaskType {
  ESSAY = 'ESSAY',
  DOCUMENT = 'DOCUMENT',
  TEST = 'TEST',
  INTERVIEW = 'INTERVIEW',
  RECOMMENDATION = 'RECOMMENDATION',
  OTHER = 'OTHER',
}

export enum VaultItemType {
  PASSWORD = 'PASSWORD',
  CREDENTIAL = 'CREDENTIAL',
  DOCUMENT = 'DOCUMENT',
  NOTE = 'NOTE',
  API_KEY = 'API_KEY',
  OTHER = 'OTHER',
}

// EssayType is already defined in types/index.ts

export enum SourceType {
  OFFICIAL = 'OFFICIAL',
  COMMUNITY = 'COMMUNITY',
  AI_GENERATED = 'AI_GENERATED',
  COLLEGEVINE = 'COLLEGEVINE',
  PREPSCHOLAR = 'PREPSCHOLAR',
  COMMON_APP = 'COMMON_APP',
}

export enum EssayStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export enum AssessmentType {
  HOLLAND = 'HOLLAND',
  MBTI = 'MBTI',
  STRENGTH = 'STRENGTH',
}
