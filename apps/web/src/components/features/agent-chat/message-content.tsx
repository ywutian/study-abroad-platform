'use client';

/**
 * 消息内容渲染组件 - Streamdown 统一处理流式与完成态的 Markdown 渲染
 */

import { useMemo } from 'react';
import { Streamdown } from 'streamdown';
import { cjk } from '@streamdown/cjk';
import { SchoolRecommendationCards, SchoolRecommendation } from './school-recommendation-cards';

// 尝试解析结构化数据
function tryParseStructuredData(
  content: string
): { type: 'schools'; data: SchoolRecommendation[] } | null {
  // 匹配 JSON 代码块
  const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[1]);

    // 检测学校推荐格式
    if (parsed.schools && Array.isArray(parsed.schools)) {
      const schools = parsed.schools.filter((s: SchoolRecommendation) => s.name);
      if (schools.length > 0) {
        return { type: 'schools', data: schools };
      }
    }
  } catch {
    // 解析失败，返回 null
  }

  return null;
}

// 共享 Markdown 组件覆盖 — Streamdown components prop
const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-2 ml-4 list-disc space-y-1">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-2 ml-4 list-decimal space-y-1">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  code: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
    const isInline = !className;
    return isInline ? (
      <code className="px-1.5 py-0.5 rounded-md bg-black/10 dark:bg-white/10 text-sm font-mono">
        {children}
      </code>
    ) : (
      <code className="block p-3 rounded-lg bg-black/10 dark:bg-white/10 text-sm font-mono overflow-x-auto">
        {children}
      </code>
    );
  },
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="relative my-2 overflow-hidden rounded-lg">{children}</pre>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="font-semibold text-base mt-4 mb-2">{children}</h3>
  ),
  h4: ({ children }: { children?: React.ReactNode }) => (
    <h4 className="font-medium mt-3 mb-1.5">{children}</h4>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-2 border-primary/50 pl-3 my-2 italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:text-primary/80"
    >
      {children}
    </a>
  ),
};

interface MessageContentProps {
  content: string;
  isStreaming?: boolean;
}

export function MessageContent({ content, isStreaming = false }: MessageContentProps) {
  // 流式输出时跳过结构化数据解析，避免解析不完整的 JSON
  const structuredData = useMemo(
    () => (isStreaming ? null : tryParseStructuredData(content)),
    [content, isStreaming]
  );

  const cleanedContent = useMemo(() => {
    if (structuredData) {
      // Remove the JSON code block and any introductory line about structured data
      return content
        .replace(/```(?:json)?\s*\n?[\s\S]*?\n?```/, '')
        .replace(/.*结构化数据.*\n?/g, '')
        .trim();
    }
    return content;
  }, [content, structuredData]);

  return (
    <>
      <Streamdown components={markdownComponents} plugins={{ cjk }} isAnimating={isStreaming}>
        {cleanedContent}
      </Streamdown>

      {/* 渲染结构化数据 */}
      {structuredData?.type === 'schools' && (
        <SchoolRecommendationCards schools={structuredData.data} />
      )}
    </>
  );
}
