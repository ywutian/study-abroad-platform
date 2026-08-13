/**
 * Content Script - 在 CommonApp 页面注入填充功能
 */

import './styles.css';

import {
  autoFillForm,
  COMMONAPP_FIELD_MAPPINGS,
  fillField,
  getAvailableFields,
  getNestedValue,
} from '../utils/field-mapper';
import { msg } from '../utils/i18n';
import { injectExtensionThemeVars } from '../utils/theme';
import type { Message, MessageResponse, UserProfile } from '../utils/types';
import { isUserProfile } from '../utils/types';

let cachedProfile: UserProfile | null = null;

injectExtensionThemeVars('#studyabroad-floating-container');

/**
 * 初始化 content script
 */
function initialize(): void {
  // 注入浮动按钮
  injectFloatingButton();

  // 监听来自 background 的消息
  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (typeof message !== 'object' || message === null || !('type' in message)) {
      return false;
    }

    if (message.type === 'FILL_CURRENT_FIELD') {
      fillCurrentFocusedField();
      sendResponse({ success: true });
    } else if (message.type === 'FILL_ALL') {
      handleFillAll().then(sendResponse);
      return true; // 异步响应
    }
    return false;
  });
}

/**
 * 注入浮动填充按钮
 */
function injectFloatingButton(): void {
  // 检查是否已注入
  if (document.getElementById('studyabroad-floating-btn')) {
    return;
  }

  const container = document.createElement('div');
  container.id = 'studyabroad-floating-container';
  container.innerHTML = `
    <div id="studyabroad-floating-btn" class="studyabroad-fab">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
      </svg>
    </div>
    <div id="studyabroad-menu" class="studyabroad-menu hidden">
      <div class="studyabroad-menu-header">
        <span class="studyabroad-logo">Lumni</span>
        <button id="studyabroad-close" class="studyabroad-close">&times;</button>
      </div>
      <div class="studyabroad-menu-body">
        <button id="studyabroad-fill-all" class="studyabroad-btn studyabroad-btn-primary">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 10H6v-2h8v2zm4-4H6v-2h12v2z"/>
          </svg>
          ${msg('fillAll')}
        </button>
        <button id="studyabroad-select-fields" class="studyabroad-btn">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
          </svg>
          ${msg('selectFields')}
        </button>
        <button id="studyabroad-sync" class="studyabroad-btn">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
          </svg>
          ${msg('syncData')}
        </button>
        <div id="studyabroad-status" class="studyabroad-status"></div>
      </div>
      <div id="studyabroad-field-selector" class="studyabroad-field-selector hidden">
        <div class="studyabroad-fields-header">
          <span>${msg('selectFieldsTitle')}</span>
          <button id="studyabroad-back" class="studyabroad-back">&larr; ${msg('back')}</button>
        </div>
        <div id="studyabroad-fields-list" class="studyabroad-fields-list"></div>
        <button id="studyabroad-fill-selected" class="studyabroad-btn studyabroad-btn-primary">
          ${msg('fillSelected')}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  // 绑定事件
  bindEvents();
}

/**
 * 绑定 UI 事件
 */
function bindEvents(): void {
  const fab = document.getElementById('studyabroad-floating-btn');
  const menu = document.getElementById('studyabroad-menu');
  const closeBtn = document.getElementById('studyabroad-close');
  const fillAllBtn = document.getElementById('studyabroad-fill-all');
  const selectFieldsBtn = document.getElementById('studyabroad-select-fields');
  const syncBtn = document.getElementById('studyabroad-sync');
  const backBtn = document.getElementById('studyabroad-back');
  const fillSelectedBtn = document.getElementById('studyabroad-fill-selected');
  const fieldSelector = document.getElementById('studyabroad-field-selector');
  const menuBody = document.querySelector('.studyabroad-menu-body');

  // 切换菜单
  fab?.addEventListener('click', () => {
    menu?.classList.toggle('hidden');
    if (!menu?.classList.contains('hidden')) {
      loadProfile();
    }
  });

  // 关闭菜单
  closeBtn?.addEventListener('click', () => {
    menu?.classList.add('hidden');
  });

  // 一键填充
  fillAllBtn?.addEventListener('click', handleFillAll);

  // 选择字段
  selectFieldsBtn?.addEventListener('click', () => {
    menuBody?.classList.add('hidden');
    fieldSelector?.classList.remove('hidden');
    renderFieldsList();
  });

  // 同步数据
  syncBtn?.addEventListener('click', handleSync);

  // 返回主菜单
  backBtn?.addEventListener('click', () => {
    fieldSelector?.classList.add('hidden');
    menuBody?.classList.remove('hidden');
  });

  // 填充选中字段
  fillSelectedBtn?.addEventListener('click', handleFillSelected);

  // 点击外部关闭
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (!target.closest('#studyabroad-floating-container')) {
      menu?.classList.add('hidden');
    }
  });
}

/**
 * 加载用户档案
 */
async function loadProfile(): Promise<void> {
  updateStatus(msg('loadingProfile'));

  const response = await sendMessage({ type: 'GET_PROFILE' });

  if (response.success && isUserProfile(response.data)) {
    cachedProfile = response.data;
    updateStatus(`${msg('profileLoaded')} ✓`);
  } else {
    updateStatus(msg('loginRequired'), 'error');
  }
}

/**
 * 处理一键填充
 */
async function handleFillAll(): Promise<{ success: boolean; filled: number; skipped: number }> {
  if (!cachedProfile) {
    await loadProfile();
  }

  if (!cachedProfile) {
    updateStatus(msg('profileMissing'), 'error');
    return { success: false, filled: 0, skipped: 0 };
  }

  updateStatus(msg('filling'));

  const result = autoFillForm(cachedProfile);

  if (result.filled > 0) {
    updateStatus(msg('filledCount', result.filled), 'success');
  } else {
    updateStatus(msg('noFillableFields'), 'warning');
  }

  return { success: true, ...result };
}

/**
 * 处理同步
 */
async function handleSync(): Promise<void> {
  updateStatus(msg('syncing'));

  const response = await sendMessage({ type: 'SYNC_PROFILE' });

  if (response.success && isUserProfile(response.data)) {
    cachedProfile = response.data;
    updateStatus(`${msg('syncSuccess')} ✓`, 'success');
  } else {
    updateStatus(msg('syncFailed'), 'error');
  }
}

/**
 * 渲染字段列表
 */
function renderFieldsList(): void {
  const container = document.getElementById('studyabroad-fields-list');
  if (!container) return;

  const fields = getAvailableFields();
  const availableFields = fields.filter((f) => f.hasElement);

  if (availableFields.length === 0) {
    container.innerHTML = `<p class="studyabroad-no-fields">${msg('noFieldsOnPage')}</p>`;
    return;
  }

  // The only user-derived value in this template. `field.profilePath` and
  // getFieldLabel() come from the static field map, and msg() from the
  // extension's own locale bundle — this is the one string the user typed.
  // Self-XSS rather than cross-user (it is the extension owner's own profile,
  // in their own browser), but a template literal going straight into
  // innerHTML is the textbook sink and escaping it costs one call.
  const esc = (v: string) =>
    v
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  container.innerHTML = availableFields
    .map((field) => {
      const value = cachedProfile ? getNestedValue(cachedProfile, field.profilePath) : undefined;
      const hasValue = value !== undefined && value !== null && value !== '';

      return `
        <label class="studyabroad-field-item ${hasValue ? '' : 'disabled'}">
          <input type="checkbox" data-path="${field.profilePath}" ${hasValue ? 'checked' : 'disabled'}>
          <span class="studyabroad-field-name">${getFieldLabel(field.profilePath)}</span>
          <span class="studyabroad-field-value">${hasValue ? esc(truncate(String(value), 20)) : msg('noData')}</span>
        </label>
      `;
    })
    .join('');
}

/**
 * 处理选择性填充
 */
function handleFillSelected(): void {
  if (!cachedProfile) {
    updateStatus(msg('loadProfileFirst'), 'error');
    return;
  }

  const checkboxes = document.querySelectorAll<HTMLInputElement>(
    '#studyabroad-fields-list input[type="checkbox"]:checked'
  );

  let filled = 0;

  checkboxes.forEach((checkbox) => {
    const path = checkbox.dataset.path;
    if (!path) return;

    const mapping = COMMONAPP_FIELD_MAPPINGS.find((m) => m.profilePath === path);
    if (!mapping) return;

    const elements = document.querySelectorAll<HTMLElement>(mapping.selector);
    const value = getNestedValue(cachedProfile!, path);

    elements.forEach((element) => {
      if (fillField(element, value, mapping.type)) {
        filled++;
      }
    });
  });

  updateStatus(msg('filledCount', filled), filled > 0 ? 'success' : 'warning');
}

/**
 * 填充当前聚焦的字段
 */
function fillCurrentFocusedField(): void {
  const activeElement = document.activeElement as HTMLElement;
  if (!activeElement || !cachedProfile) return;

  // 查找匹配的映射
  for (const mapping of COMMONAPP_FIELD_MAPPINGS) {
    if (activeElement.matches(mapping.selector)) {
      const value = getNestedValue(cachedProfile, mapping.profilePath);
      if (value !== undefined) {
        fillField(activeElement, value, mapping.type);
        updateStatus(msg('fieldFilled'), 'success');
        return;
      }
    }
  }

  updateStatus(msg('fieldUnknown'), 'warning');
}

/**
 * 发送消息到 background
 */
function sendMessage(message: Message): Promise<MessageResponse> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      resolve(response || { success: false, error: 'No response' });
    });
  });
}

/**
 * 更新状态显示
 */
function updateStatus(
  message: string,
  type: 'success' | 'error' | 'warning' | 'info' = 'info'
): void {
  const status = document.getElementById('studyabroad-status');
  if (status) {
    status.textContent = message;
    status.className = `studyabroad-status studyabroad-status-${type}`;
  }
}

/**
 * 获取字段标签
 */
function getFieldLabel(path: string): string {
  const labels: Record<string, string> = {
    firstName: msg('fieldFirstName'),
    lastName: msg('fieldLastName'),
    middleName: msg('fieldMiddleName'),
    preferredName: msg('fieldPreferredName'),
    email: msg('fieldEmail'),
    phone: msg('fieldPhone'),
    dateOfBirth: msg('fieldDateOfBirth'),
    'address.street': msg('fieldAddressStreet'),
    'address.city': msg('fieldAddressCity'),
    'address.state': msg('fieldAddressState'),
    'address.zipCode': msg('fieldAddressZipCode'),
    'address.country': msg('fieldAddressCountry'),
    'education.currentSchool': msg('fieldEducationCurrentSchool'),
    'education.graduationYear': msg('fieldEducationGraduationYear'),
    'education.gpa': msg('fieldEducationGpa'),
    'education.gpaScale': msg('fieldEducationGpaScale'),
    'education.classRank': msg('fieldEducationClassRank'),
    'education.classSize': msg('fieldEducationClassSize'),
    'testScores.SAT.total': msg('fieldSatTotal'),
    'testScores.SAT.math': msg('fieldSatMath'),
    'testScores.SAT.reading': msg('fieldSatReading'),
    'testScores.ACT.composite': msg('fieldActComposite'),
    'testScores.TOEFL.total': msg('fieldToeflTotal'),
  };

  return labels[path] || path.split('.').pop() || path;
}

/**
 * 截断文本
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
