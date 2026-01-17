'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

// Translations for 404 page
const translations = {
  zh: {
    title: '页面未找到 - 留学申请平台',
    heading: '页面未找到',
    message: '抱歉，您访问的页面不存在或已被移动。请检查链接是否正确，或返回首页。',
    goHome: '返回首页',
    orVisit: '或者访问以下页面：',
    casesLib: '案例库',
    ranking: '学校榜单',
    prediction: '录取预测',
    copyright: '© 2026 留学申请平台',
  },
  en: {
    title: 'Page Not Found - Study Abroad Platform',
    heading: 'Page Not Found',
    message:
      'Sorry, the page you are looking for does not exist or has been moved. Please check the link or return to the homepage.',
    goHome: 'Back to Home',
    orVisit: 'Or visit the following pages:',
    casesLib: 'Case Library',
    ranking: 'School Rankings',
    prediction: 'Admission Prediction',
    copyright: '© 2026 Study Abroad Platform',
  },
};

export default function NotFound() {
  const [locale, setLocale] = useState<'zh' | 'en'>('en');

  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/zh')) {
      setLocale('zh');
    } else if (!path.startsWith('/en')) {
      const browserLang = navigator.language.toLowerCase();
      if (browserLang.startsWith('zh')) setLocale('zh');
    }
  }, []);

  const t = translations[locale];

  return (
    <html lang={locale}>
      <head>
        <title>{t.title}</title>
      </head>
      <body
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
          display: 'flex',
          flexDirection: 'column',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif',
          margin: 0,
          padding: 0,
        }}
      >
        {/* Main Content */}
        <main
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div style={{ textAlign: 'center', maxWidth: '32rem' }}>
            {/* 404 Number */}
            <h1
              style={{
                fontSize: 'clamp(8rem, 20vw, 12rem)',
                fontWeight: 'bold',
                lineHeight: 1,
                background: 'linear-gradient(135deg, #60a5fa, #22d3ee, #2dd4bf)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                opacity: 0.3,
                marginBottom: '2rem',
              }}
            >
              404
            </h1>

            {/* Text Content */}
            <h2
              style={{
                fontSize: '1.875rem',
                fontWeight: 'bold',
                color: 'white',
                marginBottom: '1rem',
              }}
            >
              {t.heading}
            </h2>
            <p
              style={{
                color: '#94a3b8',
                marginBottom: '2rem',
                fontSize: '1.125rem',
                lineHeight: 1.6,
              }}
            >
              {t.message}
            </p>

            {/* Action Button */}
            <Link
              href={`/${locale}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '0.5rem',
                background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
                padding: '0.75rem 1.5rem',
                color: 'white',
                fontWeight: 500,
                textDecoration: 'none',
                transition: 'opacity 0.2s',
              }}
            >
              {t.goHome}
            </Link>

            {/* Quick Links */}
            <div
              style={{
                marginTop: '3rem',
                paddingTop: '2rem',
                borderTop: '1px solid #334155',
              }}
            >
              <p
                style={{
                  fontSize: '0.875rem',
                  color: '#64748b',
                  marginBottom: '1rem',
                }}
              >
                {t.orVisit}
              </p>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  justifyContent: 'center',
                }}
              >
                <Link
                  href={`/${locale}/cases`}
                  style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.875rem' }}
                >
                  {t.casesLib}
                </Link>
                <Link
                  href={`/${locale}/ranking`}
                  style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.875rem' }}
                >
                  {t.ranking}
                </Link>
                <Link
                  href={`/${locale}/prediction`}
                  style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.875rem' }}
                >
                  {t.prediction}
                </Link>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer
          style={{
            padding: '1.5rem',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontSize: '0.875rem',
              color: '#64748b',
              margin: 0,
            }}
          >
            {t.copyright}
          </p>
        </footer>
      </body>
    </html>
  );
}
