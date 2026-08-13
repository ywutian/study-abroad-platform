export function isProtectedPointSettingKey(key: string): boolean {
  return key === 'points_enabled' || key.startsWith('points_action_');
}
