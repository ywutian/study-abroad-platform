'use client';

import { Link } from '@/lib/i18n/navigation';
import { useTranslations } from 'next-intl';
import { GraduationCap, Sparkles, TrendingUp, Users, Globe, Star } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  
  const features = [
    { icon: Sparkles, text: 'AI 智能选校推荐', color: 'from-blue-500 to-cyan-500' },
    { icon: TrendingUp, text: '95% 预测准确率', color: 'from-emerald-500 to-teal-500' },
    { icon: Users, text: '10,000+ 真实案例', color: 'from-violet-500 to-purple-500' },
    { icon: Globe, text: '覆盖 500+ 院校', color: 'from-orange-500 to-amber-500' },
  ];

  const testimonials = [
    { name: '李同学', school: 'MIT CS 2025', avatar: 'L', quote: '这个平台帮助我成功拿到了 MIT 的 offer！' },
    { name: '王同学', school: 'Stanford EE 2025', avatar: 'W', quote: 'AI 预测非常准确，推荐!' },
    { name: '张同学', school: 'CMU SCS 2025', avatar: 'Z', quote: '案例库对我帮助很大' },
  ];

  return (
    <div className="relative min-h-screen flex bg-auth-bg overflow-hidden">
      {/* 动态背景 */}
      <div className="absolute inset-0">
        {/* 网格背景 */}
        <div className="absolute inset-0 bg-[linear-gradient(var(--auth-grid)_1px,transparent_1px),linear-gradient(90deg,var(--auth-grid)_1px,transparent_1px)] bg-[size:60px_60px]" />
        
        {/* 渐变光晕 */}
        <div className="absolute -left-[300px] top-[10%] h-[600px] w-[600px] rounded-full bg-[var(--auth-glow-1)] blur-[150px]" />
        <div className="absolute -right-[200px] bottom-[20%] h-[500px] w-[500px] rounded-full bg-[var(--auth-glow-2)] blur-[150px]" />
        <div className="absolute left-[30%] top-[60%] h-[400px] w-[400px] rounded-full bg-[var(--auth-glow-3)] blur-[120px]" />
        
        {/* 星星装饰 */}
        <div className="absolute top-[15%] left-[10%] text-auth-star">
          <Star className="h-3 w-3 fill-current" />
        </div>
        <div className="absolute top-[25%] right-[15%] text-auth-star opacity-75">
          <Star className="h-2 w-2 fill-current" />
        </div>
        <div className="absolute bottom-[30%] left-[20%] text-auth-star opacity-50">
          <Star className="h-4 w-4 fill-current" />
        </div>
      </div>
      
      {/* Logo - 固定在左上角 */}
      <div className="absolute left-6 top-6 z-20 sm:left-8 sm:top-8">
        <Link href="/" className="group flex items-center gap-2.5 text-xl font-bold text-auth hover:opacity-90 transition-all">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 shadow-lg shadow-blue-500/25 group-hover:shadow-blue-500/40 transition-shadow">
            <GraduationCap className="h-5 w-5 text-white" />
            <div className="absolute inset-0 rounded-xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <span className="bg-gradient-to-r from-[var(--auth-text)] to-[var(--auth-text-muted)] bg-clip-text text-transparent">StudyAbroad</span>
        </Link>
      </div>

      {/* 左侧装饰区 - 仅在大屏幕显示 */}
      <div className="hidden lg:flex lg:w-[55%] flex-col justify-center items-center p-12 xl:p-16 relative">
        <div className="max-w-xl text-auth space-y-10">
          {/* 主标题 */}
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--auth-input-bg)] border border-[var(--auth-card-border)] backdrop-blur-sm">
              <Sparkles className="h-4 w-4 text-blue-400" />
              <span className="text-sm text-auth-muted">AI 驱动的智能留学平台</span>
            </div>
            <h1 className="text-4xl xl:text-5xl font-bold leading-[1.15] tracking-tight">
              开启你的
              <span className="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400">
                留学之旅
              </span>
            </h1>
            <p className="text-lg text-auth-subtle leading-relaxed max-w-md">
              智能选校、精准预测、案例分享<br />让留学申请不再迷茫
            </p>
          </div>

          {/* 特性列表 */}
          <div className="grid grid-cols-2 gap-3">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="group flex items-center gap-3 p-4 rounded-2xl bg-[var(--auth-input-bg)] backdrop-blur-sm border border-[var(--auth-card-border)] hover:bg-[var(--auth-card-bg)] hover:border-[var(--auth-input-border)] transition-all duration-300"
              >
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${feature.color} shadow-lg`}>
                  <feature.icon className="h-5 w-5 text-white" />
                </div>
                <span className="text-sm font-medium text-auth-muted group-hover:text-auth transition-colors">{feature.text}</span>
              </div>
            ))}
          </div>

          {/* 用户评价滚动 */}
          <div className="pt-8 border-t border-[var(--auth-divider)]">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex -space-x-2">
                {testimonials.map((t, i) => (
                  <div key={i} className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-white text-xs font-semibold ring-2 ring-[var(--auth-bg)]">
                    {t.avatar}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1 text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-current" />
                ))}
              </div>
              <span className="text-sm text-auth-subtle">10,000+ 用户好评</span>
            </div>
            <blockquote className="text-auth-subtle italic text-sm leading-relaxed">
              "{testimonials[0].quote}"
            </blockquote>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-white font-semibold text-sm">
                {testimonials[0].avatar}
              </div>
              <div>
                <p className="text-sm font-medium text-auth-muted">{testimonials[0].name}</p>
                <p className="text-xs text-auth-subtle">{testimonials[0].school}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 浮动装饰元素 */}
        <div className="absolute top-24 right-16 h-24 w-24 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 backdrop-blur-xl border border-[var(--auth-card-border)] rotate-12 animate-float" />
        <div className="absolute bottom-28 left-16 h-16 w-16 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 backdrop-blur-xl border border-[var(--auth-card-border)] -rotate-12 animate-float-delayed" />
        <div className="absolute top-[45%] right-8 h-12 w-12 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 backdrop-blur-xl border border-[var(--auth-card-border)] rotate-6 animate-float-slow" />
      </div>

      {/* 右侧表单区 */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 lg:p-12">
        <div className="relative w-full max-w-[420px]">
          {/* 卡片外发光 */}
          <div className="absolute -inset-px bg-gradient-to-b from-[var(--auth-card-border)] to-transparent rounded-3xl" />
          <div className="absolute -inset-1 bg-gradient-to-br from-[var(--auth-glow-1)] via-transparent to-[var(--auth-glow-2)] rounded-3xl blur-xl opacity-60" />
          
          {/* 表单卡片 */}
          <div className="relative rounded-3xl border border-[var(--auth-card-border)] bg-[var(--auth-card-bg)] backdrop-blur-2xl shadow-2xl overflow-hidden">
            {/* 顶部装饰线 */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--auth-card-border)] to-transparent" />
            
            {/* 内容 */}
            <div className="relative px-8 py-10 sm:px-10 sm:py-12">
              {children}
            </div>
          </div>
        </div>
      </div>

      {/* 动画样式 */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(12deg); }
          50% { transform: translateY(-20px) rotate(15deg); }
        }
        @keyframes float-delayed {
          0%, 100% { transform: translateY(0) rotate(-12deg); }
          50% { transform: translateY(-15px) rotate(-8deg); }
        }
        @keyframes float-slow {
          0%, 100% { transform: translateY(0) rotate(6deg); }
          50% { transform: translateY(-10px) rotate(10deg); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animate-float-delayed {
          animation: float-delayed 5s ease-in-out infinite;
          animation-delay: 1s;
        }
        .animate-float-slow {
          animation: float-slow 8s ease-in-out infinite;
          animation-delay: 2s;
        }
      `}</style>
    </div>
  );
}
