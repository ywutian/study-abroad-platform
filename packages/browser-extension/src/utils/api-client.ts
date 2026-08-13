/**
 * API 客户端 - 与主平台通信
 */

import type { Activity, Award, Essay, StorageData, UserProfile } from './types';

// 从环境变量或默认值获取 API 地址
const API_BASE_URL = 'https://www.lumniedu.com/api/v1';

/**
 * 获取存储的 token
 */
export async function getAuthToken(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['token'], (result) => {
      const storage = result as Partial<StorageData>;
      resolve(typeof storage.token === 'string' ? storage.token : null);
    });
  });
}

/**
 * 保存 token
 */
export async function saveAuthToken(token: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ token }, () => {
      resolve();
    });
  });
}

/**
 * 清除 token
 */
export async function clearAuthToken(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove(['token', 'profile'], () => {
      resolve();
    });
  });
}

/**
 * 获取缓存的用户档案
 */
export async function getCachedProfile(): Promise<UserProfile | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['profile', 'lastSync'], (result) => {
      const storage = result as Partial<StorageData>;
      if (storage.profile && typeof storage.lastSync === 'number') {
        // 缓存有效期 5 分钟
        const isValid = Date.now() - storage.lastSync < 5 * 60 * 1000;
        if (isValid) {
          resolve(storage.profile);
          return;
        }
      }
      resolve(null);
    });
  });
}

/**
 * 缓存用户档案
 */
export async function cacheProfile(profile: UserProfile): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set(
      {
        profile,
        lastSync: Date.now(),
      },
      () => {
        resolve();
      }
    );
  });
}

/**
 * 从服务器获取用户档案
 */
export async function fetchProfile(): Promise<UserProfile | null> {
  const token = await getAuthToken();
  if (!token) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/profiles/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        await clearAuthToken();
      }
      return null;
    }

    const data = await response.json();
    const profile = transformApiResponse(data);
    await cacheProfile(profile);
    return profile;
  } catch (error) {
    console.error('Failed to fetch profile:', error);
    return null;
  }
}

/**
 * 验证登录状态
 */
export async function checkLoginStatus(): Promise<boolean> {
  const token = await getAuthToken();
  if (!token) {
    return false;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/users/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 转换 API 响应为 UserProfile 格式
 */
type ApiRecord = Record<string, unknown>;

function asRecord(value: unknown): ApiRecord {
  return typeof value === 'object' && value !== null ? (value as ApiRecord) : {};
}

function asRecords(value: unknown): ApiRecord[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function transformApiResponse(data: unknown): UserProfile {
  const root = asRecord(data);
  const profile = asRecord(root.profile);
  const user = Object.keys(asRecord(root.user)).length > 0 ? asRecord(root.user) : root;
  const address = asRecord(profile.address);
  const citizenship = asRecord(profile.citizenship);
  const gender = ['male', 'female', 'other'].includes(String(profile.gender))
    ? (profile.gender as UserProfile['gender'])
    : undefined;

  return {
    firstName: optionalString(profile.firstName) ?? '',
    lastName: optionalString(profile.lastName) ?? '',
    middleName: optionalString(profile.middleName),
    preferredName: optionalString(profile.preferredName),
    dateOfBirth: optionalString(profile.dateOfBirth),
    gender,
    email: optionalString(user.email) ?? '',
    phone: optionalString(profile.phone),

    address: profile.address
      ? {
          street: optionalString(address.street),
          city: optionalString(address.city),
          state: optionalString(address.state),
          zipCode: optionalString(address.zipCode),
          country: optionalString(address.country),
        }
      : undefined,

    citizenship: profile.citizenship
      ? {
          country: optionalString(citizenship.country),
          status: optionalString(citizenship.status),
        }
      : undefined,

    education: {
      currentSchool: optionalString(profile.currentSchool),
      schoolCity: optionalString(profile.schoolCity),
      schoolState: optionalString(profile.schoolState),
      graduationYear: optionalNumber(profile.graduationYear),
      gpa: optionalNumber(profile.gpa),
      gpaScale: optionalNumber(profile.gpaScale) ?? 4,
      classRank: optionalNumber(profile.classRank),
      classSize: optionalNumber(profile.classSize),
    },

    testScores: transformTestScores(root.testScores),

    activities: asRecords(root.activities).map(transformActivity),

    awards: asRecords(root.awards).map(transformAward),

    essays: asRecords(root.essays).map(transformEssay),
  };
}

function transformActivity(activity: ApiRecord): Activity {
  const grades = Array.isArray(activity.grades) ? activity.grades : [];
  return {
    name: optionalString(activity.name) ?? '',
    type: optionalString(activity.type) ?? '',
    description: optionalString(activity.description) ?? '',
    role: optionalString(activity.role) ?? '',
    grade9: grades.includes('9'),
    grade10: grades.includes('10'),
    grade11: grades.includes('11'),
    grade12: grades.includes('12'),
    hoursPerWeek: optionalNumber(activity.hoursPerWeek) ?? 0,
    weeksPerYear: optionalNumber(activity.weeksPerYear) ?? 0,
  };
}

function transformAward(award: ApiRecord): Award {
  const allowedLevels: Award['level'][] = [
    'school',
    'regional',
    'state',
    'national',
    'international',
  ];
  const level = allowedLevels.includes(award.level as Award['level'])
    ? (award.level as Award['level'])
    : 'school';
  return {
    name: optionalString(award.name) ?? '',
    level,
    year: optionalNumber(award.year) ?? new Date().getFullYear(),
    description: optionalString(award.description),
  };
}

function transformEssay(essay: ApiRecord): Essay {
  return {
    prompt: optionalString(essay.prompt) ?? '',
    content: optionalString(essay.content) ?? '',
    wordCount: optionalNumber(essay.wordCount) ?? 0,
  };
}

/**
 * 转换标化成绩
 */
function transformTestScores(value: unknown): UserProfile['testScores'] {
  const result: UserProfile['testScores'] = {};

  for (const score of asRecords(value)) {
    const sections = asRecord(score.scores);
    switch (optionalString(score.testType)?.toUpperCase()) {
      case 'SAT':
        result.SAT = {
          total: optionalNumber(score.totalScore),
          math: optionalNumber(sections.math),
          reading: optionalNumber(sections.reading),
        };
        break;
      case 'ACT':
        result.ACT = {
          composite: optionalNumber(score.totalScore),
          english: optionalNumber(sections.english),
          math: optionalNumber(sections.math),
          reading: optionalNumber(sections.reading),
          science: optionalNumber(sections.science),
        };
        break;
      case 'TOEFL':
        result.TOEFL = {
          total: optionalNumber(score.totalScore),
          reading: optionalNumber(sections.reading),
          listening: optionalNumber(sections.listening),
          speaking: optionalNumber(sections.speaking),
          writing: optionalNumber(sections.writing),
        };
        break;
      case 'IELTS':
        result.IELTS = {
          overall: optionalNumber(score.totalScore),
        };
        break;
    }
  }

  return result;
}
