import * as SecureStore from "expo-secure-store";

import type { AuthSession, AuthUser } from "../types/auth";

const SESSION_KEY = "rapiv_auth_session";
const LEGACY_SESSION_KEYS = ["rapidin_auth_session", "rapidin_business_session"];

export const sessionStorage = {
  async saveSession(session: AuthSession): Promise<void> {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
    await Promise.all(LEGACY_SESSION_KEYS.map((key) => SecureStore.deleteItemAsync(key)));
  },

  async loadSession(): Promise<AuthSession | null> {
    const rawSession = await SecureStore.getItemAsync(SESSION_KEY);

    if (!rawSession) {
      return null;
    }

    try {
      const session = JSON.parse(rawSession) as AuthSession;
      await this.saveSession(session);
      return session;
    } catch {
      await this.clearSession();
      return null;
    }
  },

  async clearSession(): Promise<void> {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    await Promise.all(LEGACY_SESSION_KEYS.map((key) => SecureStore.deleteItemAsync(key)));
  },

  async getAccessToken(): Promise<string | null> {
    const session = await this.loadSession();
    return session?.accessToken ?? null;
  },

  async setUser(user: AuthUser): Promise<void> {
    const session = await this.loadSession();

    if (session) {
      await this.saveSession({ ...session, user });
    }
  },

  async getUser(): Promise<AuthUser | null> {
    const session = await this.loadSession();
    return session?.user ?? null;
  }
};

export const saveSession = sessionStorage.saveSession.bind(sessionStorage);
export const loadSession = sessionStorage.loadSession.bind(sessionStorage);
export const clearSession = sessionStorage.clearSession.bind(sessionStorage);
export const getAccessToken = sessionStorage.getAccessToken.bind(sessionStorage);
export const setUser = sessionStorage.setUser.bind(sessionStorage);
export const getUser = sessionStorage.getUser.bind(sessionStorage);
