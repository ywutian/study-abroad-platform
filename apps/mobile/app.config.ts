import type { ExpoConfig } from 'expo/config';

const appJson = require('./app.json') as {
  expo: ExpoConfig & {
    extra?: {
      eas?: {
        projectId?: string;
      };
      [key: string]: unknown;
    };
  };
};

export default (): ExpoConfig => {
  const baseConfig = appJson.expo;
  const configuredProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();

  return {
    ...baseConfig,
    extra: {
      ...baseConfig.extra,
      eas: {
        ...baseConfig.extra?.eas,
        projectId: configuredProjectId || baseConfig.extra?.eas?.projectId,
      },
    },
  };
};
