/**
 * API 客户端 - 与主平台通信
 */

import type { UserProfile, StorageData } from './types';

// 从环境变量或默认值获取 API 地址
const API_BASE_URL = 'http://localhost:3001/api';

/**
 * 获取存储的 token
 */
export async function getAuthToken(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['token'], (result) => {
      resolve(result.token || null);
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
      if (result.profile && result.lastSync) {
        // 缓存有效期 5 分钟
        const isValid = Date.now() - result.lastSync < 5 * 60 * 1000;
        if (isValid) {
          resolve(result.profile);
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
    const response = await fetch(`${API_BASE_URL}/profile/me`, {
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
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
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
function transformApiResponse(data: any): UserProfile {
  const profile = data.profile || {};
  const user = data.user || data;

  return {
    firstName: profile.firstName || '',
    lastName: profile.lastName || '',
    middleName: profile.middleName,
    preferredName: profile.preferredName,
    dateOfBirth: profile.dateOfBirth,
    gender: profile.gender,
    email: user.email || '',
    phone: profile.phone,

    address: profile.address
      ? {
          street: profile.address.street,
          city: profile.address.city,
          state: profile.address.state,
          zipCode: profile.address.zipCode,
          country: profile.address.country,
        }
      : undefined,

    citizenship: profile.citizenship
      ? {
          country: profile.citizenship.country,
          status: profile.citizenship.status,
        }
      : undefined,

    education: {
      currentSchool: profile.currentSchool,
      schoolCity: profile.schoolCity,
      schoolState: profile.schoolState,
      graduationYear: profile.graduationYear,
      gpa: profile.gpa,
      gpaScale: profile.gpaScale || 4.0,
      classRank: profile.classRank,
      classSize: profile.classSize,
    },

    testScores: transformTestScores(data.testScores || []),

    activities: (data.activities || []).map((a: any) => ({
      name: a.name,
      type: a.type,
      description: a.description,
      role: a.role || '',
      grade9: a.grades?.includes('9') || false,
      grade10: a.grades?.includes('10') || false,
      grade11: a.grades?.includes('11') || false,
      grade12: a.grades?.includes('12') || false,
      hoursPerWeek: a.hoursPerWeek || 0,
      weeksPerYear: a.weeksPerYear || 0,
    })),

    awards: (data.awards || []).map((a: any) => ({
      name: a.name,
      level: a.level || 'school',
      year: a.year,
      description: a.description,
    })),

    essays: (data.essays || []).map((e: any) => ({
      prompt: e.prompt || '',
      content: e.content || '',
      wordCount: e.wordCount || 0,
    })),
  };
}

/**
 * 转换标化成绩
 */
function transformTestScores(scores: any[]): UserProfile['testScores'] {
  const result: UserProfile['testScores'] = {};

  for (const score of scores) {
    switch (score.testType?.toUpperCase()) {
      case 'SAT':
        result.SAT = {
          total: score.totalScore,
          math: score.scores?.math,
          reading: score.scores?.reading,
        };
        break;
      case 'ACT':
        result.ACT = {
          composite: score.totalScore,
          english: score.scores?.english,
          math: score.scores?.math,
          reading: score.scores?.reading,
          science: score.scores?.science,
        };
        break;
      case 'TOEFL':
        result.TOEFL = {
          total: score.totalScore,
          reading: score.scores?.reading,
          listening: score.scores?.listening,
          speaking: score.scores?.speaking,
          writing: score.scores?.writing,
        };
        break;
      case 'IELTS':
        result.IELTS = {
          overall: score.totalScore,
        };
        break;
    }
  }

  return result;
}
