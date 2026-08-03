import AsyncStorage from '@react-native-async-storage/async-storage';

const REGISTERED_PUSH_TOKEN_KEY = 'registered_expo_push_token';

export const saveRegisteredPushToken = (token: string) =>
  AsyncStorage.setItem(REGISTERED_PUSH_TOKEN_KEY, token);

export const getRegisteredPushToken = () => AsyncStorage.getItem(REGISTERED_PUSH_TOKEN_KEY);

export const clearRegisteredPushToken = () => AsyncStorage.removeItem(REGISTERED_PUSH_TOKEN_KEY);
