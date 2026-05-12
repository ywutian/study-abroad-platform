import type { SchoolPublicMediaAsset } from '@study-abroad/shared';

const WIKIMEDIA_UPLOAD_HOST = 'upload.wikimedia.org';
const WIKIMEDIA_THUMB_WIDTHS = [120, 250, 500] as const;
const DEFAULT_WIKIMEDIA_THUMB_WIDTH = 500;

export type PublicSchoolMediaAssetInput = {
  sourceType: string;
  storageUrl?: string | null;
  originalUrl?: string | null;
  sourcePageUrl?: string | null;
  license?: string | null;
  attribution?: string | null;
  width?: number | null;
  height?: number | null;
};

export function toWikimediaThumbnailUrl(
  originalUrl: string,
  width = DEFAULT_WIKIMEDIA_THUMB_WIDTH,
): string | null {
  let parsed: URL;
  try {
    parsed = new URL(originalUrl);
  } catch {
    return null;
  }

  if (parsed.hostname !== WIKIMEDIA_UPLOAD_HOST) return null;
  const thumbWidth =
    WIKIMEDIA_THUMB_WIDTHS.find((candidate) => candidate >= width) ??
    WIKIMEDIA_THUMB_WIDTHS[WIKIMEDIA_THUMB_WIDTHS.length - 1];

  const segments = parsed.pathname.split('/').filter(Boolean);
  const commonsIndex = segments.findIndex((segment) => segment === 'commons');
  if (commonsIndex < 0) return null;

  const thumbIndex = segments.findIndex((segment) => segment === 'thumb');
  if (thumbIndex >= 0) {
    const thumbnailSegment = segments[segments.length - 1];
    const fileMatch = thumbnailSegment.match(/^\d+px-(.+)$/);
    if (!fileMatch) return null;
    const prefix = segments.slice(0, -1).join('/');
    return `https://${WIKIMEDIA_UPLOAD_HOST}/${prefix}/${thumbWidth}px-${fileMatch[1]}`;
  }

  const shardA = segments[commonsIndex + 1];
  const shardB = segments[commonsIndex + 2];
  const fileSegment = segments[commonsIndex + 3];
  if (!shardA || !shardB || !fileSegment) return null;

  const prefix = segments.slice(0, commonsIndex + 1).join('/');
  return `https://${WIKIMEDIA_UPLOAD_HOST}/${prefix}/thumb/${shardA}/${shardB}/${fileSegment}/${thumbWidth}px-${fileSegment}`;
}

export function toPublicSchoolMediaAsset(
  asset: PublicSchoolMediaAssetInput | null | undefined,
  options: { wikimediaWidth?: number } = {},
): SchoolPublicMediaAsset | null {
  if (!asset) return null;
  const directUrl = asset.storageUrl ?? asset.originalUrl;
  if (!directUrl) return null;

  const url =
    !asset.storageUrl && asset.sourceType === 'WIKIMEDIA_COMMONS'
      ? (toWikimediaThumbnailUrl(
          directUrl,
          options.wikimediaWidth ?? DEFAULT_WIKIMEDIA_THUMB_WIDTH,
        ) ?? directUrl)
      : directUrl;

  return {
    url,
    sourceType: asset.sourceType as SchoolPublicMediaAsset['sourceType'],
    originalUrl: asset.originalUrl,
    sourcePageUrl: asset.sourcePageUrl,
    license: asset.license,
    attribution: asset.attribution,
    width: asset.width,
    height: asset.height,
  };
}
