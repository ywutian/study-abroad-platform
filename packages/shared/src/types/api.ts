// API Types & Common Enums

import type { User } from './auth';
import type { AuthTokens } from './auth';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  locale?: string;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

export interface RegisterResponse {
  user: User;
  message: string;
}

export interface HealthStatus {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  checks: {
    database: 'ok' | 'error';
  };
}

// Data Provenance
export interface FieldProvenance {
  source: string;
  at: string;
}

export type ProvenanceRecord = Record<string, FieldProvenance>;

/** Human-readable labels for school data sources */
export const DATA_SOURCE_LABELS: Record<string, { en: string; zh: string }> = {
  COLLEGE_SCORECARD: { en: 'US Dept. of Education', zh: '美国教育部' },
  URBAN_INSTITUTE: {
    en: 'Urban Institute (Federal Data)',
    zh: 'Urban Institute (联邦教育数据)',
  },
  BIGFUTURE: { en: 'College Board', zh: 'College Board' },
  APPILY: { en: 'Appily (data aggregator)', zh: 'Appily (数据聚合平台)' },
  IPEDS: {
    en: 'US Federal Statistics (IPEDS)',
    zh: '美国联邦教育统计 (IPEDS)',
  },
  MANUAL_ADMIN: { en: 'Platform verified', zh: '平台审核' },
  SEED: { en: 'Initial dataset', zh: '初始数据' },
  SCRAPER: { en: 'School website', zh: '学校官网' },
};

// Additional enums from Prisma schema
export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum VerificationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum RecommendationLetterStatus {
  NOT_REQUESTED = 'NOT_REQUESTED',
  REQUESTED = 'REQUESTED',
  IN_PROGRESS = 'IN_PROGRESS',
  SUBMITTED = 'SUBMITTED',
  CONFIRMED = 'CONFIRMED',
}

export enum ApplicationStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  SUBMITTED = 'SUBMITTED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  WAITLISTED = 'WAITLISTED',
  WITHDRAWN = 'WITHDRAWN',
}

export enum MemoryType {
  FACT = 'FACT',
  PREFERENCE = 'PREFERENCE',
  DECISION = 'DECISION',
  SUMMARY = 'SUMMARY',
  FEEDBACK = 'FEEDBACK',
}
