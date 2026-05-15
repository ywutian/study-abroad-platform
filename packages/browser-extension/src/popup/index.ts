/**
 * Popup 脚本 - 扩展弹出窗口逻辑
 */

import type { UserProfile, Message, MessageResponse } from '../utils/types';
import { applyI18n, msg } from '../utils/i18n';
import { injectExtensionThemeVars } from '../utils/theme';

let profile: UserProfile | null = null;

injectExtensionThemeVars();

/**
 * 初始化 Popup
 */
async function initialize(): Promise<void> {
  applyI18n();

  // 绑定事件
  bindEvents();

  // 检查登录状态
  await checkLoginStatus();
}

/**
 * 绑定 UI 事件
 */
function bindEvents(): void {
  document.getElementById('login-btn')?.addEventListener('click', handleLogin);
  document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
  document.getElementById('sync-btn')?.addEventListener('click', handleSync);
  document.getElementById('fill-btn')?.addEventListener('click', handleFillCurrentPage);
  document.getElementById('settings-btn')?.addEventListener('click', handleOpenSettings);
}

/**
 * 检查登录状态
 */
async function checkLoginStatus(): Promise<void> {
  showLoading(true);

  const response = await sendMessage({ type: 'LOGIN_STATUS' });

  if (response.success && response.data?.isLoggedIn) {
    await loadProfile();
    showLoggedInView();
  } else {
    showLoggedOutView();
  }

  showLoading(false);
}

/**
 * 加载用户档案
 */
async function loadProfile(): Promise<void> {
  const response = await sendMessage({ type: 'GET_PROFILE' });

  if (response.success && response.data) {
    profile = response.data;
    updateProfileDisplay();
  }
}

/**
 * 更新档案显示
 */
function updateProfileDisplay(): void {
  if (!profile) return;

  const nameEl = document.getElementById('user-name');
  const emailEl = document.getElementById('user-email');
  const statsEl = document.getElementById('profile-stats');

  if (nameEl) {
    nameEl.textContent =
      `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || msg('unsetName');
  }

  if (emailEl) {
    emailEl.textContent = profile.email || '';
  }

  if (statsEl) {
    const stats = [
      { label: msg('statActivities'), value: profile.activities?.length || 0 },
      { label: msg('statAwards'), value: profile.awards?.length || 0 },
      { label: msg('statEssays'), value: profile.essays?.length || 0 },
    ];

    statsEl.innerHTML = stats
      .map(
        (s) =>
          `<div class="stat"><span class="stat-value">${s.value}</span><span class="stat-label">${s.label}</span></div>`
      )
      .join('');
  }
}

/**
 * 显示已登录视图
 */
function showLoggedInView(): void {
  document.getElementById('logged-out-view')?.classList.add('hidden');
  document.getElementById('logged-in-view')?.classList.remove('hidden');
}

/**
 * 显示未登录视图
 */
function showLoggedOutView(): void {
  document.getElementById('logged-in-view')?.classList.add('hidden');
  document.getElementById('logged-out-view')?.classList.remove('hidden');
}

/**
 * 显示/隐藏加载状态
 */
function showLoading(show: boolean): void {
  const loader = document.getElementById('loading');
  if (loader) {
    loader.classList.toggle('hidden', !show);
  }
}

/**
 * 处理登录
 */
function handleLogin(): void {
  // 打开主站登录页面
  chrome.tabs.create({
    url: 'https://www.lumniedu.com/login?redirect=extension',
  });
}

/**
 * 处理登出
 */
async function handleLogout(): Promise<void> {
  await chrome.storage.local.clear();
  profile = null;
  showLoggedOutView();
  showStatus(msg('loggedOut'), 'info');
}

/**
 * 处理同步
 */
async function handleSync(): Promise<void> {
  showStatus(msg('syncing'), 'info');

  const response = await sendMessage({ type: 'SYNC_PROFILE' });

  if (response.success && response.data) {
    profile = response.data;
    updateProfileDisplay();
    showStatus(msg('syncSuccess'), 'success');
  } else {
    showStatus(msg('syncFailed'), 'error');
  }
}

/**
 * 处理填充当前页面
 */
async function handleFillCurrentPage(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.id) {
    showStatus(msg('noActiveTab'), 'error');
    return;
  }

  if (!tab.url?.includes('commonapp.org')) {
    showStatus(msg('openCommonAppFirst'), 'warning');
    return;
  }

  showStatus(msg('filling'), 'info');

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'FILL_ALL' });

    if (response?.success) {
      showStatus(msg('filledCount', response.filled || 0), 'success');
    } else {
      showStatus(msg('fillFailed'), 'error');
    }
  } catch (error) {
    showStatus(msg('cannotConnectPage'), 'error');
  }
}

/**
 * 打开设置
 */
function handleOpenSettings(): void {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
  }
}

/**
 * 显示状态消息
 */
function showStatus(
  message: string,
  type: 'success' | 'error' | 'warning' | 'info' = 'info'
): void {
  const statusEl = document.getElementById('status-message');
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = `status status-${type}`;
    statusEl.classList.remove('hidden');

    setTimeout(() => {
      statusEl.classList.add('hidden');
    }, 3000);
  }
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

// 页面加载后初始化
document.addEventListener('DOMContentLoaded', initialize);
