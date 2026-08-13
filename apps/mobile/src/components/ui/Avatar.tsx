import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Image } from 'expo-image';
import { useColors, fontSize, fontWeight, borderRadius } from '@/utils/theme';

type AvatarSize = 'sm' | 'default' | 'lg' | 'xl';

export interface AvatarProps {
  source?: string | null;
  fallbackSource?: string | null;
  name?: string;
  size?: AvatarSize;
  style?: StyleProp<ViewStyle>;
}

export function Avatar({ source, fallbackSource, name, size = 'default', style }: AvatarProps) {
  const colors = useColors();
  const [useFallback, setUseFallback] = useState(false);
  const [hideImage, setHideImage] = useState(false);

  const primarySource = source ?? null;
  const secondarySource = useMemo(() => {
    if (!fallbackSource || fallbackSource === primarySource) {
      return null;
    }
    return fallbackSource;
  }, [fallbackSource, primarySource]);

  useEffect(() => {
    setUseFallback(false);
    setHideImage(false);
  }, [primarySource, secondarySource]);

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return { dimension: 32, fontSize: fontSize.xs };
      case 'lg':
        return { dimension: 56, fontSize: fontSize.xl };
      case 'xl':
        return { dimension: 72, fontSize: fontSize['2xl'] };
      default:
        return { dimension: 40, fontSize: fontSize.base };
    }
  };

  const sizeStyles = getSizeStyles();
  const initials = name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  const imageSource = hideImage
    ? null
    : useFallback
      ? secondarySource
      : (primarySource ?? secondarySource);

  const handleImageError = () => {
    if (!useFallback && primarySource && secondarySource) {
      setUseFallback(true);
      return;
    }
    setHideImage(true);
  };

  return (
    <View
      style={[
        styles.container,
        {
          width: sizeStyles.dimension,
          height: sizeStyles.dimension,
          backgroundColor: colors.muted,
          borderRadius: sizeStyles.dimension / 2,
        },
        style,
      ]}
    >
      {imageSource ? (
        <Image
          source={{ uri: imageSource }}
          placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={200}
          onError={handleImageError}
          style={[
            styles.image,
            {
              width: sizeStyles.dimension,
              height: sizeStyles.dimension,
              borderRadius: sizeStyles.dimension / 2,
            },
          ]}
        />
      ) : (
        <Text
          style={[
            styles.initials,
            {
              fontSize: sizeStyles.fontSize,
              color: colors.foregroundMuted,
            },
          ]}
        >
          {initials || '?'}
        </Text>
      )}
    </View>
  );
}

interface AvatarGroupProps {
  children: React.ReactNode;
  max?: number;
  size?: AvatarSize;
}

export function AvatarGroup({ children, max = 3, size = 'default' }: AvatarGroupProps) {
  const colors = useColors();
  const childArray = React.Children.toArray(children);
  const visibleChildren = childArray.slice(0, max);
  const remainingCount = childArray.length - max;

  const getSizeOffset = () => {
    switch (size) {
      case 'sm':
        return -12;
      case 'lg':
        return -20;
      case 'xl':
        return -24;
      default:
        return -16;
    }
  };
  const overlapStyle = { marginLeft: getSizeOffset() };

  return (
    <View style={styles.group}>
      {visibleChildren.map((child, index) => (
        <View
          key={index}
          style={[
            styles.groupItem,
            styles.groupItemBorder,
            {
              zIndex: visibleChildren.length - index,
              borderColor: colors.background,
            },
            index > 0 && overlapStyle,
          ]}
        >
          {child}
        </View>
      ))}
      {remainingCount > 0 && (
        <View
          style={[
            styles.groupItem,
            styles.groupItemBorder,
            {
              backgroundColor: colors.muted,
              borderColor: colors.background,
            },
            overlapStyle,
          ]}
        >
          <Avatar name={`+${remainingCount}`} size={size} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {},
  initials: {
    fontWeight: fontWeight.medium,
  },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupItem: {
    overflow: 'hidden',
  },
  groupItemBorder: {
    borderWidth: 2,
    borderRadius: borderRadius.full,
  },
});
