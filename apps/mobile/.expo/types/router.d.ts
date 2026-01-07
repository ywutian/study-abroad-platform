/* eslint-disable */
import * as Router from 'expo-router';

export * from 'expo-router';

declare module 'expo-router' {
  export namespace ExpoRouter {
    export interface __routes<T extends string = string> extends Record<string, unknown> {
      StaticRoutes: `/` | `/(auth)` | `/(auth)/forgot-password` | `/(auth)/login` | `/(auth)/register` | `/(tabs)` | `/(tabs)/` | `/(tabs)/ai` | `/(tabs)/cases` | `/(tabs)/profile` | `/(tabs)/schools` | `/_sitemap` | `/ai` | `/cases` | `/forgot-password` | `/login` | `/profile` | `/register` | `/schools`;
      DynamicRoutes: `/case/${Router.SingleRoutePart<T>}` | `/chat/${Router.SingleRoutePart<T>}` | `/school/${Router.SingleRoutePart<T>}`;
      DynamicRouteTemplate: `/case/[id]` | `/chat/[id]` | `/school/[id]`;
    }
  }
}
