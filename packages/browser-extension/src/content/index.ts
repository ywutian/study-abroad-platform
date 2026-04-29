/**
 * Content Script - 在 CommonApp 页面注入填充功能
 */

import {
  autoFillForm,
  getAvailableFields,
  fillField,
  getNestedValue,
  COMMONAPP_FIELD_MAPPINGS,
} from '../utils/field-mapper';
import type { UserProfile, Message, MessageResponse } from '../utils/types';
import './styles.css';

let cachedProfile: UserProfile | null = null;

/**
 * 初始化 content script
 */
function initialize(): void {
  console.log('[Lumni Extension] Content script loaded on CommonApp');

  // 注入浮动按钮
  injectFloatingButton();

  // 监听来自 background 的消息
  chrome.runtime.onMessage.addListener((message: any, _sender, sendResponse) => {
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
          一键填充
        </button>
        <button id="studyabroad-select-fields" class="studyabroad-btn">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
          </svg>
          选择字段
        </button>
        <button id="studyabroad-sync" class="studyabroad-btn">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
          </svg>
          同步数据
        </button>
        <div id="studyabroad-status" class="studyabroad-status"></div>
      </div>
      <div id="studyabroad-field-selector" class="studyabroad-field-selector hidden">
        <div class="studyabroad-fields-header">
          <span>选择要填充的字段</span>
          <button id="studyabroad-back" class="studyabroad-back">&larr; 返回</button>
        </div>
        <div id="studyabroad-fields-list" class="studyabroad-fields-list"></div>
        <button id="studyabroad-fill-selected" class="studyabroad-btn studyabroad-btn-primary">
          填充选中字段
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
  updateStatus('正在加载档案...');

  const response = await sendMessage({ type: 'GET_PROFILE' });

  if (response.success && response.data) {
    cachedProfile = response.data;
    updateStatus('档案已加载 ✓');
  } else {
    updateStatus('请先登录平台', 'error');
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
    updateStatus('未找到档案数据', 'error');
    return { success: false, filled: 0, skipped: 0 };
  }

  updateStatus('正在填充...');

  const result = autoFillForm(cachedProfile);

  if (result.filled > 0) {
    updateStatus(`已填充 ${result.filled} 个字段`, 'success');
  } else {
    updateStatus('当前页面无可填充字段', 'warning');
  }

  return { success: true, ...result };
}

/**
 * 处理同步
 */
async function handleSync(): Promise<void> {
  updateStatus('正在同步...');

  const response = await sendMessage({ type: 'SYNC_PROFILE' });

  if (response.success && response.data) {
    cachedProfile = response.data;
    updateStatus('同步成功 ✓', 'success');
  } else {
    updateStatus('同步失败', 'error');
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
    container.innerHTML = '<p class="studyabroad-no-fields">当前页面没有可填充的字段</p>';
    return;
  }

  container.innerHTML = availableFields
    .map((field) => {
      const value = cachedProfile ? getNestedValue(cachedProfile, field.profilePath) : undefined;
      const hasValue = value !== undefined && value !== null && value !== '';

      return `
        <label class="studyabroad-field-item ${hasValue ? '' : 'disabled'}">
          <input type="checkbox" data-path="${field.profilePath}" ${hasValue ? 'checked' : 'disabled'}>
          <span class="studyabroad-field-name">${getFieldLabel(field.profilePath)}</span>
          <span class="studyabroad-field-value">${hasValue ? truncate(String(value), 20) : '无数据'}</span>
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
    updateStatus('请先加载档案', 'error');
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

  updateStatus(`已填充 ${filled} 个字段`, filled > 0 ? 'success' : 'warning');
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
        updateStatus('已填充字段', 'success');
        return;
      }
    }
  }

  updateStatus('无法识别此字段', 'warning');
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
    firstName: '名',
    lastName: '姓',
    middleName: '中间名',
    preferredName: '昵称',
    email: '邮箱',
    phone: '电话',
    dateOfBirth: '出生日期',
    'address.street': '街道地址',
    'address.city': '城市',
    'address.state': '州/省',
    'address.zipCode': '邮编',
    'address.country': '国家',
    'education.currentSchool': '当前学校',
    'education.graduationYear': '毕业年份',
    'education.gpa': 'GPA',
    'education.gpaScale': 'GPA 满分',
    'education.classRank': '班级排名',
    'education.classSize': '班级人数',
    'testScores.SAT.total': 'SAT 总分',
    'testScores.SAT.math': 'SAT 数学',
    'testScores.SAT.reading': 'SAT 阅读',
    'testScores.ACT.composite': 'ACT 综合',
    'testScores.TOEFL.total': 'TOEFL 总分',
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
