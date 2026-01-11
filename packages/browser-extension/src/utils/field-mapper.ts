/**
 * CommonApp 字段映射器
 */

import type { UserProfile, FieldMapping } from './types';

/**
 * CommonApp 字段映射配置
 * 基于 CommonApp 表单的实际字段
 */
export const COMMONAPP_FIELD_MAPPINGS: FieldMapping[] = [
  // =====================================
  // 个人信息 (Profile)
  // =====================================
  {
    selector: '[name="firstName"], [data-testid="firstName"], #firstName',
    profilePath: 'firstName',
    type: 'text',
  },
  {
    selector: '[name="lastName"], [data-testid="lastName"], #lastName',
    profilePath: 'lastName',
    type: 'text',
  },
  {
    selector: '[name="middleName"], [data-testid="middleName"], #middleName',
    profilePath: 'middleName',
    type: 'text',
  },
  {
    selector: '[name="preferredName"], [data-testid="preferredName"]',
    profilePath: 'preferredName',
    type: 'text',
  },
  {
    selector: '[name="email"], [data-testid="email"], #email',
    profilePath: 'email',
    type: 'text',
  },
  {
    selector: '[name="phone"], [data-testid="phone"], #phone',
    profilePath: 'phone',
    type: 'text',
  },
  {
    selector: '[name="dateOfBirth"], [data-testid="dateOfBirth"]',
    profilePath: 'dateOfBirth',
    type: 'date',
  },

  // =====================================
  // 地址 (Address)
  // =====================================
  {
    selector: '[name="street"], [data-testid="address-street"]',
    profilePath: 'address.street',
    type: 'text',
  },
  {
    selector: '[name="city"], [data-testid="address-city"]',
    profilePath: 'address.city',
    type: 'text',
  },
  {
    selector: '[name="state"], [data-testid="address-state"]',
    profilePath: 'address.state',
    type: 'select',
  },
  {
    selector: '[name="zipCode"], [data-testid="address-zip"]',
    profilePath: 'address.zipCode',
    type: 'text',
  },
  {
    selector: '[name="country"], [data-testid="address-country"]',
    profilePath: 'address.country',
    type: 'select',
  },

  // =====================================
  // 教育信息 (Education)
  // =====================================
  {
    selector: '[name="highSchool"], [data-testid="current-school"]',
    profilePath: 'education.currentSchool',
    type: 'text',
  },
  {
    selector: '[name="graduationYear"], [data-testid="graduation-year"]',
    profilePath: 'education.graduationYear',
    type: 'select',
  },
  {
    selector: '[name="gpa"], [data-testid="gpa"]',
    profilePath: 'education.gpa',
    type: 'text',
  },
  {
    selector: '[name="gpaScale"], [data-testid="gpa-scale"]',
    profilePath: 'education.gpaScale',
    type: 'select',
  },
  {
    selector: '[name="classRank"], [data-testid="class-rank"]',
    profilePath: 'education.classRank',
    type: 'text',
  },
  {
    selector: '[name="classSize"], [data-testid="class-size"]',
    profilePath: 'education.classSize',
    type: 'text',
  },

  // =====================================
  // 标化成绩 (Test Scores)
  // =====================================
  {
    selector: '[name="satTotal"], [data-testid="sat-total"]',
    profilePath: 'testScores.SAT.total',
    type: 'text',
  },
  {
    selector: '[name="satMath"], [data-testid="sat-math"]',
    profilePath: 'testScores.SAT.math',
    type: 'text',
  },
  {
    selector: '[name="satReading"], [data-testid="sat-reading"]',
    profilePath: 'testScores.SAT.reading',
    type: 'text',
  },
  {
    selector: '[name="actComposite"], [data-testid="act-composite"]',
    profilePath: 'testScores.ACT.composite',
    type: 'text',
  },
  {
    selector: '[name="toeflTotal"], [data-testid="toefl-total"]',
    profilePath: 'testScores.TOEFL.total',
    type: 'text',
  },
];

/**
 * 根据路径获取对象属性值
 */
export function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

/**
 * 填充表单字段
 */
export function fillField(element: HTMLElement, value: any, type: string): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  try {
    switch (type) {
      case 'text':
        return fillTextField(element as HTMLInputElement, String(value));
      case 'select':
        return fillSelectField(element as HTMLSelectElement, String(value));
      case 'radio':
        return fillRadioField(element as HTMLInputElement, String(value));
      case 'checkbox':
        return fillCheckboxField(element as HTMLInputElement, Boolean(value));
      case 'date':
        return fillDateField(element as HTMLInputElement, String(value));
      default:
        return false;
    }
  } catch (error) {
    console.error(`Failed to fill field:`, error);
    return false;
  }
}

/**
 * 填充文本输入框
 */
function fillTextField(input: HTMLInputElement, value: string): boolean {
  if (!input || input.disabled || input.readOnly) {
    return false;
  }

  // 清除现有值
  input.value = '';
  
  // 设置新值
  input.value = value;
  
  // 触发事件以通知表单验证
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.dispatchEvent(new Event('blur', { bubbles: true }));
  
  // 添加高亮效果
  highlightField(input);
  
  return true;
}

/**
 * 填充下拉选择框
 */
function fillSelectField(select: HTMLSelectElement, value: string): boolean {
  if (!select || select.disabled) {
    return false;
  }

  // 查找匹配的选项
  const options = Array.from(select.options);
  const matchingOption = options.find(
    (opt) => 
      opt.value.toLowerCase() === value.toLowerCase() ||
      opt.text.toLowerCase() === value.toLowerCase() ||
      opt.text.toLowerCase().includes(value.toLowerCase())
  );

  if (matchingOption) {
    select.value = matchingOption.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    highlightField(select);
    return true;
  }

  return false;
}

/**
 * 填充单选按钮
 */
function fillRadioField(input: HTMLInputElement, value: string): boolean {
  if (!input || input.disabled) {
    return false;
  }

  const name = input.name;
  const radios = document.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${name}"]`);
  
  for (const radio of radios) {
    if (radio.value.toLowerCase() === value.toLowerCase()) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
      highlightField(radio.parentElement || radio);
      return true;
    }
  }

  return false;
}

/**
 * 填充复选框
 */
function fillCheckboxField(input: HTMLInputElement, value: boolean): boolean {
  if (!input || input.disabled) {
    return false;
  }

  input.checked = value;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  highlightField(input.parentElement || input);
  return true;
}

/**
 * 填充日期字段
 */
function fillDateField(input: HTMLInputElement, value: string): boolean {
  if (!input || input.disabled || input.readOnly) {
    return false;
  }

  // 尝试解析日期
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return false;
  }

  // 格式化为 ISO 日期
  const formattedDate = date.toISOString().split('T')[0];
  input.value = formattedDate;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  
  highlightField(input);
  return true;
}

/**
 * 高亮已填充的字段
 */
function highlightField(element: HTMLElement): void {
  const originalBackground = element.style.backgroundColor;
  const originalTransition = element.style.transition;
  
  element.style.transition = 'background-color 0.3s ease';
  element.style.backgroundColor = '#d4edda'; // 浅绿色高亮
  
  setTimeout(() => {
    element.style.backgroundColor = originalBackground;
    setTimeout(() => {
      element.style.transition = originalTransition;
    }, 300);
  }, 1500);
}

/**
 * 自动填充整个表单
 */
export function autoFillForm(profile: UserProfile): { filled: number; skipped: number } {
  let filled = 0;
  let skipped = 0;

  for (const mapping of COMMONAPP_FIELD_MAPPINGS) {
    const elements = document.querySelectorAll<HTMLElement>(mapping.selector);
    
    if (elements.length === 0) {
      continue;
    }

    const value = getNestedValue(profile, mapping.profilePath);
    const transformedValue = mapping.transform ? mapping.transform(value) : value;

    for (const element of elements) {
      if (fillField(element, transformedValue, mapping.type)) {
        filled++;
      } else {
        skipped++;
      }
    }
  }

  return { filled, skipped };
}

/**
 * 获取当前页面可填充的字段
 */
export function getAvailableFields(): { selector: string; profilePath: string; hasElement: boolean }[] {
  return COMMONAPP_FIELD_MAPPINGS.map((mapping) => ({
    selector: mapping.selector,
    profilePath: mapping.profilePath,
    hasElement: document.querySelector(mapping.selector) !== null,
  }));
}



