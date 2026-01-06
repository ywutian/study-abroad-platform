import { Link } from '@/lib/i18n/navigation';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-hero overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 bg-grid opacity-20" />
      <div className="absolute -left-40 top-1/4 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute -right-40 bottom-1/4 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      
      {/* Logo */}
      <div className="absolute left-4 top-4 sm:left-8 sm:top-8">
        <Link href="/" className="text-xl font-bold text-white hover:opacity-80 transition-opacity">
          StudyAbroad
        </Link>
      </div>
      
      {/* 内容 */}
      <div className="relative w-full max-w-md p-4 animate-scale-in">
        <div className="rounded-2xl border bg-card/95 backdrop-blur shadow-2xl">
          {children}
        </div>
      </div>
    </div>
  );
}
