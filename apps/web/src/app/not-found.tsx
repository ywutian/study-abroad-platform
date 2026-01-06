import Link from 'next/link';

export default function NotFound() {
  return (
    <html lang="zh">
      <head>
        <title>页面未找到 - 留学申请平台</title>
      </head>
      <body style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        margin: 0,
        padding: 0,
      }}>
        {/* Main Content */}
        <main style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}>
          <div style={{ textAlign: 'center', maxWidth: '32rem' }}>
            {/* 404 Number */}
            <h1 style={{
              fontSize: 'clamp(8rem, 20vw, 12rem)',
              fontWeight: 'bold',
              lineHeight: 1,
              background: 'linear-gradient(135deg, #60a5fa, #22d3ee, #2dd4bf)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              opacity: 0.3,
              marginBottom: '2rem',
            }}>
              404
            </h1>

            {/* Text Content */}
            <h2 style={{
              fontSize: '1.875rem',
              fontWeight: 'bold',
              color: 'white',
              marginBottom: '1rem',
            }}>
              页面未找到
            </h2>
            <p style={{
              color: '#94a3b8',
              marginBottom: '2rem',
              fontSize: '1.125rem',
              lineHeight: 1.6,
            }}>
              抱歉，您访问的页面不存在或已被移动。
              <br />
              请检查链接是否正确，或返回首页。
            </p>

            {/* Action Button */}
            <Link 
              href="/zh"
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
              返回首页
            </Link>

            {/* Quick Links */}
            <div style={{
              marginTop: '3rem',
              paddingTop: '2rem',
              borderTop: '1px solid #334155',
            }}>
              <p style={{
                fontSize: '0.875rem',
                color: '#64748b',
                marginBottom: '1rem',
              }}>
                或者访问以下页面：
              </p>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1rem',
                justifyContent: 'center',
              }}>
                <Link href="/zh/cases" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.875rem' }}>
                  案例库
                </Link>
                <Link href="/zh/ranking" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.875rem' }}>
                  学校榜单
                </Link>
                <Link href="/zh/prediction" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.875rem' }}>
                  录取预测
                </Link>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer style={{
          padding: '1.5rem',
          textAlign: 'center',
        }}>
          <p style={{
            fontSize: '0.875rem',
            color: '#64748b',
            margin: 0,
          }}>
            © 2026 留学申请平台
          </p>
        </footer>
      </body>
    </html>
  );
}
