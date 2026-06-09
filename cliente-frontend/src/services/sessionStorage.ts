import * as SecureStore from 'expo-secure-store';
import { AuthResponse, User } from '../types/auth';

const SESSION_KEYS = {
  SESSION: 'rapiv_auth_session',
  LEGACY_SESSION: 'rapidin_auth_session',
  USER: 'user_data',
  AUTH_TOKEN: 'auth_token',
  LAST_DELIVERY_ADDRESS: 'rapiv_last_delivery_address',
};

export type LastDeliveryAddress = {
  address: string;
  latitude: number;
  longitude: number;
};

export const sessionStorage = {
  async saveSession(session: AuthResponse): Promise<void> {
    try {
      await SecureStore.setItemAsync(SESSION_KEYS.SESSION, JSON.stringify(session));
      await SecureStore.deleteItemAsync(SESSION_KEYS.LEGACY_SESSION);
      await SecureStore.deleteItemAsync(SESSION_KEYS.AUTH_TOKEN);
      await SecureStore.deleteItemAsync(SESSION_KEYS.USER);
    } catch (error) {
      console.error('Error saving session:', error);
    }
  },

  async loadSession(): Promise<AuthResponse | null> {
    try {
      const rawSession = await SecureStore.getItemAsync(SESSION_KEYS.SESSION);

      if (rawSession) {
        return JSON.parse(rawSession) as AuthResponse;
      }

      const token = await SecureStore.getItemAsync(SESSION_KEYS.AUTH_TOKEN);
      const userData = await SecureStore.getItemAsync(SESSION_KEYS.USER);

      if (!token || !userData) {
        return null;
      }

      const session = {
        accessToken: token,
        user: JSON.parse(userData) as User,
      };

      await this.saveSession(session);
      return session;
    } catch (error) {
      console.error('Error loading session:', error);
      await this.clearSession();
      return null;
    }
  },

  async clearSession(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(SESSION_KEYS.SESSION);
      await SecureStore.deleteItemAsync(SESSION_KEYS.LEGACY_SESSION);
      await SecureStore.deleteItemAsync(SESSION_KEYS.USER);
      await SecureStore.deleteItemAsync(SESSION_KEYS.AUTH_TOKEN);
      await SecureStore.deleteItemAsync(SESSION_KEYS.LAST_DELIVERY_ADDRESS);
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  },

  async getAccessToken(): Promise<string | null> {
    const session = await this.loadSession();
    return session?.accessToken ?? null;
  },

  async setUser(user: User): Promise<void> {
    try {
      const session = await this.loadSession();

      if (session) {
        await this.saveSession({ ...session, user });
      }
    } catch (error) {
      console.error('Error saving user:', error);
    }
  },

  async getUser(): Promise<User | null> {
    try {
      const session = await this.loadSession();
      return session?.user ?? null;
    } catch (error) {
      console.error('Error retrieving user:', error);
      return null;
    }
  },

  async saveLastDeliveryAddress(address: LastDeliveryAddress): Promise<void> {
    try {
      await SecureStore.setItemAsync(SESSION_KEYS.LAST_DELIVERY_ADDRESS, JSON.stringify(address));
    } catch (error) {
      console.error('Error saving last delivery address:', error);
    }
  },

  async getLastDeliveryAddress(): Promise<LastDeliveryAddress | null> {
    try {
      const rawAddress = await SecureStore.getItemAsync(SESSION_KEYS.LAST_DELIVERY_ADDRESS);
      return rawAddress ? JSON.parse(rawAddress) as LastDeliveryAddress : null;
    } catch (error) {
      console.error('Error loading last delivery address:', error);
      return null;
    }
  },
};
