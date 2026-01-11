/**
 * 用户档案数据类型
 */

export interface UserProfile {
  // 基本信息
  firstName: string;
  lastName: string;
  middleName?: string;
  preferredName?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  email: string;
  phone?: string;
  
  // 地址
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  
  // 公民身份
  citizenship?: {
    country?: string;
    status?: string;
  };
  
  // 教育背景
  education?: {
    currentSchool?: string;
    schoolCity?: string;
    schoolState?: string;
    graduationYear?: number;
    gpa?: number;
    gpaScale?: number;
    classRank?: number;
    classSize?: number;
  };
  
  // 标化成绩
  testScores?: {
    SAT?: {
      total?: number;
      math?: number;
      reading?: number;
    };
    ACT?: {
      composite?: number;
      english?: number;
      math?: number;
      reading?: number;
      science?: number;
    };
    TOEFL?: {
      total?: number;
      reading?: number;
      listening?: number;
      speaking?: number;
      writing?: number;
    };
    IELTS?: {
      overall?: number;
    };
  };
  
  // 活动
  activities?: Activity[];
  
  // 荣誉
  awards?: Award[];
  
  // 文书
  essays?: Essay[];
}

export interface Activity {
  name: string;
  type: string;
  description: string;
  role: string;
  grade9: boolean;
  grade10: boolean;
  grade11: boolean;
  grade12: boolean;
  hoursPerWeek: number;
  weeksPerYear: number;
}

export interface Award {
  name: string;
  level: 'school' | 'regional' | 'state' | 'national' | 'international';
  year: number;
  description?: string;
}

export interface Essay {
  prompt: string;
  content: string;
  wordCount: number;
}

/**
 * 消息类型
 */
export interface Message {
  type: 'GET_PROFILE' | 'FILL_FORM' | 'LOGIN_STATUS' | 'SYNC_PROFILE';
  payload?: any;
}

export interface MessageResponse {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * 存储数据类型
 */
export interface StorageData {
  token?: string;
  profile?: UserProfile;
  lastSync?: number;
  settings?: ExtensionSettings;
}

export interface ExtensionSettings {
  autoFill: boolean;
  showNotifications: boolean;
  language: 'en' | 'zh';
}

/**
 * 字段映射配置
 */
export interface FieldMapping {
  selector: string;
  profilePath: string;
  type: 'text' | 'select' | 'radio' | 'checkbox' | 'date';
  transform?: (value: any) => any;
}



