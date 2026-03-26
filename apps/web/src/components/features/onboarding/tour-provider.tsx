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
    setTours((prev) => new Map(prev).set(config.id, config));
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
          box-shadow:
            0 20px 25px -5px rgb(0 0 0 / 0.1),
            0 8px 10px -6px rgb(0 0 0 / 0.1);
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
          border-radius: calc(var(--radius) - 2px);
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
          box-shadow: 0 0 0 4px oklch(0.55 0.22 265 / 30%) !important;
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
} as const;

// Tour step builder functions — accept `t` from useTranslations('tour')
type TourT = (key: string) => string;

export function getWelcomeTourSteps(t: TourT): TourStep[] {
  return [
    {
      id: 'nav-home',
      element: '[data-tour="nav-home"]',
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
      element: '[data-tour="nav-cases"]',
      popover: {
        title: t('welcome.cases'),
        description: t('welcome.casesDesc'),
        side: 'bottom',
        align: 'center',
      },
    },
    {
      id: 'nav-ai',
      element: '[data-tour="nav-ai"]',
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
