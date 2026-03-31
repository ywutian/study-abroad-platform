/**
 * Deep Linking Configuration
 *
 * expo-router handles deep linking automatically via file-based routing.
 * This module provides utilities for constructing and parsing deep link URLs.
 *
 * URL Scheme: studyabroad://
 * Universal Links: https://studyabroad.app/
 *
 * Route mapping (expo-router handles this from file structure):
 *   studyabroad://school/:id      → /school/[id]
 *   studyabroad://case/:id        → /case/[id]
 *   studyabroad://chat/:id        → /chat/[id]
 *   studyabroad://forum/:id       → /forum/[id]
 *   studyabroad://essay/:id       → /essay/[id]
 *   studyabroad://prediction      → /prediction
 *   studyabroad://timeline        → /timeline
 *   studyabroad://recommendation  → /recommendation
 *   studyabroad://assessment      → /assessment
 *   studyabroad://hall            → /hall
 *   studyabroad://teams           → /teams
 */

import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import type { Href } from 'expo-router';

/** The custom URL scheme */
export const SCHEME = 'studyabroad';

/** The universal link domain (production) */
export const UNIVERSAL_LINK_DOMAIN = 'studyabroad.app';

/**
 * Build an internal deep link URL
 * e.g. buildDeepLink('/school/abc123') → 'studyabroad://school/abc123'
 */
export function buildDeepLink(path: string): string {
  return Linking.createURL(path);
}

/**
 * Build a universal link URL for sharing
 * e.g. buildShareLink('/school/abc123') → 'https://studyabroad.app/school/abc123'
 */
export function buildShareLink(path: string): string {
  return `https://${UNIVERSAL_LINK_DOMAIN}${path}`;
}

/**
 * Navigate to a deep link path (for use from notification handlers, etc.)
 * Safely handles both internal paths and full URLs.
 */
export function navigateToDeepLink(url: string): void {
  // Strip scheme prefix if present
  const path = url.replace(`${SCHEME}://`, '/').replace(`https://${UNIVERSAL_LINK_DOMAIN}`, '');

  try {
    router.push(path as Href);
  } catch {
    // Fallback to root if path is invalid
    router.replace('/');
  }
}

/**
 * Deep link paths for common entities.
 * Use with router.push() or buildShareLink().
 */
export const deepLinkPaths = {
  school: (id: string) => `/school/${id}`,
  case: (id: string) => `/case/${id}`,
  chat: (id: string) => `/chat/${id}`,
  forum: (id: string) => `/forum/${id}`,
  essay: (id: string) => `/essay/${id}`,
  prediction: () => '/prediction',
  timeline: () => '/timeline',
  recommendation: () => '/recommendation',
  assessment: () => '/assessment',
  hall: () => '/hall',
  teams: () => '/teams',
  profile: () => '/(tabs)/profile',
} as const;
