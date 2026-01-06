'use client';

import { useState, useEffect, ImgHTMLAttributes } from 'react';
import Image, { ImageProps } from 'next/image';
import { cn } from '@/lib/utils';

interface BlurImageProps extends Omit<ImageProps, 'onLoad'> {
  fallback?: string;
  aspectRatio?: number;
}

/**
 * 带模糊占位符的图片组件
 */
export function BlurImage({
  src,
  alt,
  className,
  fallback,
  aspectRatio,
  ...props
}: BlurImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-muted',
        isLoading && 'animate-pulse',
        className
      )}
      style={aspectRatio ? { aspectRatio } : undefined}
    >
      <Image
        src={error && fallback ? fallback : src}
        alt={alt}
        className={cn(
          'object-cover transition-all duration-500',
          isLoading ? 'scale-110 blur-lg' : 'scale-100 blur-0'
        )}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setError(true);
          setIsLoading(false);
        }}
        {...props}
      />
      
      {/* 加载时的占位符 */}
      {isLoading && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/5 to-transparent animate-shimmer" />
      )}
    </div>
  );
}

/**
 * 原生 img 标签的模糊加载版本
 */
interface NativeBlurImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  fallback?: string;
  aspectRatio?: number;
}

export function NativeBlurImage({
  src,
  alt,
  className,
  fallback,
  aspectRatio,
  ...props
}: NativeBlurImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!src) return;

    const img = document.createElement('img');
    img.src = src;
    img.onload = () => {
      setCurrentSrc(src);
      setIsLoading(false);
    };
    img.onerror = () => {
      if (fallback) {
        setCurrentSrc(fallback);
      }
      setError(true);
      setIsLoading(false);
    };
  }, [src, fallback]);

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-muted',
        isLoading && 'animate-pulse',
        className
      )}
      style={aspectRatio ? { aspectRatio } : undefined}
    >
      {currentSrc && (
        <img
          src={currentSrc}
          alt={alt}
          className={cn(
            'w-full h-full object-cover transition-all duration-500',
            isLoading ? 'scale-110 blur-lg opacity-0' : 'scale-100 blur-0 opacity-100'
          )}
          {...props}
        />
      )}
      
      {/* 占位符骨架 */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-foreground/10" />
        </div>
      )}
    </div>
  );
}

/**
 * Avatar 专用模糊加载
 */
interface BlurAvatarProps {
  src?: string | null;
  alt: string;
  fallback?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeMap = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
};

export function BlurAvatar({
  src,
  alt,
  fallback,
  size = 'md',
  className,
}: BlurAvatarProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const initials = alt
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (!src || error) {
    return (
      <div
        className={cn(
          'rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium',
          sizeMap[size],
          className
        )}
      >
        {initials}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative rounded-full overflow-hidden bg-muted',
        sizeMap[size],
        className
      )}
    >
      <img
        src={src}
        alt={alt}
        className={cn(
          'w-full h-full object-cover transition-all duration-300',
          isLoading ? 'scale-110 blur-sm' : 'scale-100 blur-0'
        )}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setError(true);
          setIsLoading(false);
        }}
      />
    </div>
  );
}



