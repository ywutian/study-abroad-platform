'use client';

import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { driver, Driver, DriveStep, Config } from 'driver.js';
import 'driver.js/dist/driver.css';

// Tour 步骤定义
export interface TourStep extends DriveStep {
  id: string;
}

// Tour 配置
interface TourConfig {
  id: string;
  steps: TourStep[];
  onComplete?: () => void;
  onSkip?: () => void;
}

// Context 类型
interface TourContextValue {
  startTour: (tourId: string) => void;
  registerTour: (config: TourConfig) => void;
  isActive: boolean;
  currentTourId: string | null;
  hasCompletedTour: (tourId: string) => boolean;
  resetTour: (tourId: string) => void;
}

const TourContext = createContext<TourContextValue | null>(null);

// 本地存储 key
const TOUR_STORAGE_KEY = 'completed_tours';

export function TourProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations('tour');
  const [tours, setTours] = useState<Map<string, TourConfig>>(new Map());
  const [currentTourId, setCurrentTourId] = useState<string | null>(null);
  const [driverInstance, setDriverInstance] = useState<Driver | null>(null);
  const [completedTours, setCompletedTours] = useState<Set<string>>(new Set());

  // 加载已完成的 tours (SSR-safe)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(TOUR_STORAGE_KEY);
      if (stored) {
        setCompletedTours(new Set(JSON.parse(stored)));
      }
    } catch {
      // Ignore localStorage errors (private browsing, quota exceeded, etc.)
    }
  }, []);

  // 保存已完成的 tours
  const markTourComplete = useCallback((tourId: string) => {
    setCompletedTours((prev) => {
      const next = new Set(prev);
      next.add(tourId);
      try {
        localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        /* private browsing */
      }
      return next;
    });
  }, []);

  // 注册 tour
  const registerTour = useCallback((config: TourConfig) => {
    // ponytail: idempotent by id. Re-registering the same tour must NOT churn
    // the `tours` ref — startTour depends on [tours], so a fresh ref each call
    // gives startTour a new identity every render; any effect that depends on
    // startTour AND calls registerTour then infinite-loops (React #185 — the
    // /dashboard crash). Upgrade path: key on (id+steps) if a live tour ever
    // needs its steps updated after registration.
    setTours((prev) => (prev.has(config.id) ? prev : new Map(prev).set(config.id, config)));
  }, []);

  // 检查是否完成
  const hasCompletedTour = useCallback(
    (tourId: string) => {
      return completedTours.has(tourId);
    },
    [completedTours]
  );

  // 重置 tour
  const resetTour = useCallback((tourId: string) => {
    setCompletedTours((prev) => {
      const next = new Set(prev);
      next.delete(tourId);
      try {
        localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        /* private browsing */
      }
      return next;
    });
  }, []);

  // Cleanup driver instance on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (driverInstance) {
        driverInstance.destroy();
      }
    };
  }, [driverInstance]);

  // 启动 tour
  const startTour = useCallback(
    (tourId: string) => {
      const tour = tours.get(tourId);
      if (!tour) return;

      // 清理旧实例
      if (driverInstance) {
        driverInstance.destroy();
      }

      const driverConfig: Config = {
        showProgress: true,
        animate: true,
        smoothScroll: true,
        allowClose: true,
        stagePadding: 8,
        stageRadius: 8,
        popoverClass: 'tour-popover',
        progressText: '{{current}} / {{total}}',
        nextBtnText: t('next'),
        prevBtnText: t('previous'),
        doneBtnText: t('done'),
        steps: tour.steps,
        onDestroyed: () => {
          setCurrentTourId(null);
          markTourComplete(tourId);
          tour.onComplete?.();
        },
        onCloseClick: () => {
          tour.onSkip?.();
        },
      };

      const newDriver = driver(driverConfig);
      setDriverInstance(newDriver);
      setCurrentTourId(tourId);
      newDriver.drive();
    },
    [tours, driverInstance, markTourComplete, t]
  );

  return (
    <TourContext.Provider
      value={{
        startTour,
        registerTour,
        isActive: currentTourId !== null,
        currentTourId,
        hasCompletedTour,
        resetTour,
      }}
    >
      {children}
      <style jsx global>{`
        /* Tour 弹窗自定义样式 */
        .driver-popover.tour-popover {
          background: var(--card);
          color: var(--card-foreground);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          box-shadow: var(--theme-card-shadow);
          max-width: 340px;
        }

        .driver-popover.tour-popover .driver-popover-title {
          font-weight: 600;
          font-size: 1rem;
          color: var(--foreground);
          margin-bottom: 0.5rem;
        }

        .driver-popover.tour-popover .driver-popover-description {
          color: var(--muted-foreground);
          font-size: 0.875rem;
          line-height: 1.5;
        }

        .driver-popover.tour-popover .driver-popover-footer {
          margin-top: 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .driver-popover.tour-popover .driver-popover-progress-text {
          color: var(--muted-foreground);
          font-size: 0.75rem;
        }

        .driver-popover.tour-popover .driver-popover-navigation-btns {
          display: flex;
          gap: 0.5rem;
        }

        .driver-popover.tour-popover button {
          padding: 0.5rem 1rem;
          border-radius: var(--theme-radius-button);
          font-size: 0.875rem;
          font-weight: 500;
          transition: all 0.2s;
          cursor: pointer;
        }

        .driver-popover.tour-popover .driver-popover-prev-btn {
          background: var(--secondary);
          color: var(--secondary-foreground);
          border: 1px solid var(--border);
        }

        .driver-popover.tour-popover .driver-popover-prev-btn:hover {
          background: var(--accent);
        }

        .driver-popover.tour-popover .driver-popover-next-btn,
        .driver-popover.tour-popover .driver-popover-done-btn {
          background: var(--primary);
          color: var(--primary-foreground);
          border: none;
        }

        .driver-popover.tour-popover .driver-popover-next-btn:hover,
        .driver-popover.tour-popover .driver-popover-done-btn:hover {
          opacity: 0.9;
        }

        .driver-popover.tour-popover .driver-popover-close-btn {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--muted-foreground);
          background: transparent;
          border: none;
          padding: 0;
        }

        .driver-popover.tour-popover .driver-popover-close-btn:hover {
          color: var(--foreground);
        }

        .driver-popover.tour-popover .driver-popover-arrow {
          border-color: var(--card);
        }

        /* 高亮边框 */
        .driver-overlay {
          background: rgba(0, 0, 0, 0.6);
        }

        .driver-active-element {
          box-shadow: 0 0 0 4px var(--border) !important;
        }

        /* 响应式 */
        @media (max-width: 640px) {
          .driver-popover.tour-popover {
            max-width: calc(100vw - 2rem);
            margin: 0 1rem;
          }

          .driver-popover.tour-popover button {
            padding: 0.625rem 1rem;
            min-height: 44px;
          }
        }
      `}</style>
    </TourContext.Provider>
  );
}

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within TourProvider');
  }
  return context;
}

// 预定义的 tours
export const TOURS = {
  WELCOME: 'welcome',
  PROFILE: 'profile',
  AI_CHAT: 'ai_chat',
  SCHOOLS: 'schools',
  CASES: 'cases',
  ESSAYS_PAGE: 'essays_page',
  ESSAYS_FORM: 'essays_form',
  // 2026-05 Phase 2.7 #27: first-visit dashboard walkthrough.
  // Covers QuickAsk → CommandCenter → PriorityQueue → Workspace Hub
  // so users see the 4 key surfaces before they're left to explore alone.
  DASHBOARD: 'dashboard',
} as const;

// Tour step builder functions — accept `t` from useTranslations('tour')
type TourT = (key: string) => string;

/**
 * All five of these steps pointed at selectors nothing rendered — driver.js
 * highlights empty space rather than erroring, so every new user got a broken
 * welcome tour and nothing said so. Found by `tour-anchors.test.ts`, which
 * exists because the same class of silent breakage keeps recurring.
 *
 * Retargeted at elements that exist: the main-nav links now carry
 * `nav-<route>` derived from their href, the "More" menu opener carries
 * `nav-more` (Cases and AI live inside it, and a tour cannot highlight an item
 * in a closed dropdown), and the avatar button carries `user-menu`.
 */
export function getWelcomeTourSteps(t: TourT): TourStep[] {
  return [
    {
      id: 'nav-home',
      element: '[data-tour="nav-dashboard"]',
      popover: {
        title: t('welcome.title'),
        description: t('welcome.description'),
        side: 'bottom',
        align: 'start',
      },
    },
    {
      id: 'nav-schools',
      element: '[data-tour="nav-schools"]',
      popover: {
        title: t('welcome.schools'),
        description: t('welcome.schoolsDesc'),
        side: 'bottom',
        align: 'center',
      },
    },
    {
      id: 'nav-cases',
      element: '[data-tour="nav-more"]',
      popover: {
        title: t('welcome.cases'),
        description: t('welcome.casesDesc'),
        side: 'bottom',
        align: 'center',
      },
    },
    {
      id: 'nav-ai',
      element: '[data-tour="nav-more"]',
      popover: {
        title: t('welcome.ai'),
        description: t('welcome.aiDesc'),
        side: 'bottom',
        align: 'center',
      },
    },
    {
      id: 'user-menu',
      element: '[data-tour="user-menu"]',
      popover: {
        title: t('welcome.profile'),
        description: t('welcome.profileDesc'),
        side: 'bottom',
        align: 'end',
      },
    },
  ];
}

/**
 * 2026-05 Phase 2.7 #27: Dashboard tour — fires once on first visit
 * (TourProvider stores completion in localStorage). Highlights the 4
 * essential surfaces a new user needs to understand before they can
 * navigate the dashboard productively.
 *
 * Each step targets a `[data-tour]` attribute on the corresponding
 * dashboard surface. If the user has hidden one (e.g., DecisionPanel
 * doesn't render for new accounts), driver.js automatically skips
 * that step rather than throwing.
 */
export function getDashboardTourSteps(t: TourT): TourStep[] {
  return [
    {
      id: 'dashboard-quick-ask',
      element: '[data-tour="dashboard-quick-ask"]',
      popover: {
        title: t('dashboard.quickAsk'),
        description: t('dashboard.quickAskDesc'),
        side: 'bottom',
        align: 'start',
      },
    },
    {
      id: 'dashboard-command-center',
      element: '[data-tour="dashboard-command-center"]',
      popover: {
        title: t('dashboard.commandCenter'),
        description: t('dashboard.commandCenterDesc'),
        side: 'top',
        align: 'start',
      },
    },
    {
      id: 'dashboard-priority-queue',
      element: '[data-tour="dashboard-priority-queue"]',
      popover: {
        // 2026-05 dashboard redesign batch 2: the priority queue is now
        // a full-width section in the lower half of the flattened
        // CommandCenter (was the right sub-column). `side: 'top'` —
        // there is no longer room to anchor the popover to its left.
        title: t('dashboard.priorityQueue'),
        description: t('dashboard.priorityQueueDesc'),
        side: 'top',
        align: 'start',
      },
    },
    {
      id: 'dashboard-hub',
      element: '[data-tour="dashboard-hub"]',
      popover: {
        title: t('dashboard.hub'),
        description: t('dashboard.hubDesc'),
        side: 'top',
        align: 'center',
      },
    },
  ];
}

export function getCasesTourSteps(t: TourT): TourStep[] {
  return [
    {
      id: 'cases-filters',
      element: '[data-tour="cases-filters"]',
      popover: {
        title: t('cases.filter'),
        description: t('cases.filterDesc'),
        side: 'bottom',
        align: 'start',
      },
    },
    {
      id: 'cases-grid',
      element: '[data-tour="cases-grid"]',
      popover: {
        title: t('cases.browse'),
        description: t('cases.browseDesc'),
        side: 'top',
        align: 'center',
      },
    },
    {
      id: 'cases-share',
      element: '[data-tour="cases-share"]',
      popover: {
        title: t('cases.share'),
        description: t('cases.shareDesc'),
        side: 'bottom',
        align: 'end',
      },
    },
  ];
}
