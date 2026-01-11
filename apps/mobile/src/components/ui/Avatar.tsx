import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useColors, fontSize, fontWeight, borderRadius } from '@/utils/theme';

type AvatarSize = 'sm' | 'default' | 'lg' | 'xl';

interface AvatarProps {
  source?: string | null;
  name?: string;
  size?: AvatarSize;
  style?: StyleProp<ViewStyle>;
}

export function Avatar({ source, name, size = 'default', style }: AvatarProps) {
  const colors = useColors();

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
      {source ? (
        <Image
          source={{ uri: source }}
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
      case 'sm': return -12;
      case 'lg': return -20;
      case 'xl': return -24;
      default: return -16;
    }
  };

  return (
    <View style={styles.group}>
      {visibleChildren.map((child, index) => (
        <View
          key={index}
          style={[
            styles.groupItem,
            { 
              marginLeft: index > 0 ? getSizeOffset() : 0,
              zIndex: visibleChildren.length - index,
              borderWidth: 2,
              borderColor: colors.background,
              borderRadius: borderRadius.full,
            },
          ]}
        >
          {child}
        </View>
      ))}
      {remainingCount > 0 && (
        <View
          style={[
            styles.groupItem,
            {
              marginLeft: getSizeOffset(),
              backgroundColor: colors.muted,
              borderWidth: 2,
              borderColor: colors.background,
              borderRadius: borderRadius.full,
            },
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
  image: {
    resizeMode: 'cover',
  },
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
});









