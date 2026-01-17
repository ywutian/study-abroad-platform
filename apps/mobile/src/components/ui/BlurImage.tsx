/**
 * BlurImage 组件
 *
 * 带模糊占位符的图片组件，使用 expo-image 实现
 * 支持 BlurHash 占位符、渐进式加载
 */

import React, { useState } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Image, ImageContentFit, ImageSource, ImageStyle as ExpoImageStyle } from 'expo-image';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useColors, borderRadius as themeRadius } from '@/utils/theme';

// 默认 BlurHash 占位符 (灰色模糊)
const DEFAULT_BLUR_HASH = 'L6PZfSi_.AyE_3t7t7R*~qj[ayj[';

interface BlurImageProps {
  source: ImageSource | string;
  alt?: string;
  blurHash?: string;
  width?: number | string;
  height?: number | string;
  aspectRatio?: number;
  contentFit?: ImageContentFit;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ExpoImageStyle>;
  priority?: 'low' | 'normal' | 'high';
  cachePolicy?: 'none' | 'disk' | 'memory' | 'memory-disk';
  transition?: number;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

const AnimatedImage = Animated.createAnimatedComponent(Image);

export function BlurImage({
  source,
  alt,
  blurHash = DEFAULT_BLUR_HASH,
  width,
  height,
  aspectRatio,
  contentFit = 'cover',
  borderRadius = 0,
  style,
  imageStyle,
  priority = 'normal',
  cachePolicy = 'memory-disk',
  transition = 300,
  onLoad,
  onError,
}: BlurImageProps) {
  const colors = useColors();
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const opacity = useSharedValue(0);

  // 处理图片源
  const imageSource: ImageSource = typeof source === 'string' ? { uri: source } : source;

  const handleLoad = () => {
    setIsLoaded(true);
    opacity.value = withTiming(1, { duration: transition });
    onLoad?.();
  };

  const handleError = (error: any) => {
    setHasError(true);
    onError?.(error);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const containerStyle: ViewStyle = {
    width: width as number,
    height: height as number,
    aspectRatio,
    borderRadius,
    overflow: 'hidden',
    backgroundColor: colors.muted,
  };

  return (
    <View style={[containerStyle, style]}>
      {/* BlurHash 占位符 */}
      <Image
        style={[StyleSheet.absoluteFill, { borderRadius }]}
        source={{ uri: '' }}
        placeholder={blurHash}
        contentFit={contentFit}
        placeholderContentFit={contentFit}
        transition={0}
      />

      {/* 实际图片 */}
      {!hasError && (
        <AnimatedImage
          style={[StyleSheet.absoluteFill, { borderRadius }, animatedStyle, imageStyle]}
          source={imageSource}
          contentFit={contentFit}
          priority={priority}
          cachePolicy={cachePolicy}
          onLoad={handleLoad}
          onError={handleError}
          accessibilityLabel={alt}
        />
      )}

      {/* 错误状态 */}
      {hasError && (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.errorContainer,
            { backgroundColor: colors.muted },
          ]}
        >
          <Image
            style={styles.errorIcon}
            source={require('@expo/vector-icons')}
            contentFit="contain"
          />
        </View>
      )}
    </View>
  );
}

/**
 * 头像组件 (带默认样式)
 */
interface AvatarImageProps extends Omit<BlurImageProps, 'borderRadius'> {
  size?: number;
}

export function AvatarImage({ size = 48, ...props }: AvatarImageProps) {
  return <BlurImage width={size} height={size} borderRadius={size / 2} {...props} />;
}

/**
 * 卡片图片组件 (带默认样式)
 */
export function CardImage(props: BlurImageProps) {
  return (
    <BlurImage aspectRatio={16 / 9} borderRadius={themeRadius.lg} contentFit="cover" {...props} />
  );
}

/**
 * 缩略图组件
 */
interface ThumbnailImageProps extends BlurImageProps {
  size?: 'sm' | 'md' | 'lg';
}

const thumbnailSizes = {
  sm: 64,
  md: 96,
  lg: 128,
};

export function ThumbnailImage({ size = 'md', ...props }: ThumbnailImageProps) {
  const dimension = thumbnailSizes[size];
  return (
    <BlurImage width={dimension} height={dimension} borderRadius={themeRadius.md} {...props} />
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorIcon: {
    width: 24,
    height: 24,
    opacity: 0.5,
  },
});
