import React from 'react';

import { Avatar, type AvatarProps } from '@/components/ui/Avatar';
import { getSchoolLogoSources } from '@/lib/schools/logo';

interface SchoolAvatarProps extends Pick<AvatarProps, 'size' | 'style'> {
  name?: string | null;
  logoUrl?: string | null;
  website?: string | null;
}

export function SchoolAvatar({ name, logoUrl, website, size, style }: SchoolAvatarProps) {
  const { source, fallbackSource } = getSchoolLogoSources({ logoUrl, website });

  return (
    <Avatar
      source={source}
      fallbackSource={fallbackSource}
      name={name ?? undefined}
      size={size}
      style={style}
    />
  );
}
