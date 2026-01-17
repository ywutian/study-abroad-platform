/**
 * 后台服务工作者 - 管理扩展状态和消息传递
 */

import { fetchProfile, checkLoginStatus, getCachedProfile } from '../utils/api-client';
import type { Message, MessageResponse } from '../utils/types';

// 监听扩展安装/更新
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[StudyAbroad Extension] Installed:', details.reason);

  if (details.reason === 'install') {
    // 首次安装，显示欢迎页面
    chrome.tabs.create({
      url: chrome.runtime.getURL('welcome.html'),
    });
  }
});

// 监听来自 content script 和 popup 的消息
chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse: (response: MessageResponse) => void) => {
    handleMessage(message)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          success: false,
          error: error.message || 'Unknown error',
        });
      });

    // 返回 true 以支持异步响应
    return true;
  }
);

/**
 * 处理消息
 */
async function handleMessage(message: Message): Promise<MessageResponse> {
  switch (message.type) {
    case 'GET_PROFILE': {
      // 优先使用缓存
      let profile = await getCachedProfile();

      if (!profile) {
        profile = await fetchProfile();
      }

      if (profile) {
        return { success: true, data: profile };
      }
      return { success: false, error: 'Profile not available' };
    }

    case 'LOGIN_STATUS': {
      const isLoggedIn = await checkLoginStatus();
      return { success: true, data: { isLoggedIn } };
    }

    case 'SYNC_PROFILE': {
      const profile = await fetchProfile();
      if (profile) {
        return { success: true, data: profile };
      }
      return { success: false, error: 'Failed to sync profile' };
    }

    default:
      return { success: false, error: 'Unknown message type' };
  }
}

// 监听标签页更新，在 CommonApp 页面显示徽章
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) {
    return;
  }

  const isCommonApp = tab.url.includes('commonapp.org');

  if (isCommonApp) {
    // 设置徽章显示
    await chrome.action.setBadgeText({ tabId, text: 'CA' });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: '#4F46E5' });
  } else {
    await chrome.action.setBadgeText({ tabId, text: '' });
  }
});

// 上下文菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'fill-field',
    title: 'Fill with StudyAbroad data',
    contexts: ['editable'],
    documentUrlPatterns: ['https://apply.commonapp.org/*', 'https://www.commonapp.org/*'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'fill-field' && tab?.id) {
    // 发送消息到 content script 填充当前聚焦的字段
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: 'FILL_CURRENT_FIELD',
      });
    } catch (error) {
      console.error('Failed to send fill message:', error);
    }
  }
});

console.log('[StudyAbroad Extension] Background service worker initialized');
