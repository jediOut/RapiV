import { apiRequest } from "./apiClient";
import type {
  AuthSession,
  AuthUser,
  LoginPayload,
  RegisterBusinessPayload
} from "../types/auth";

type BusinessResponse = {
  id: string;
  name: string;
  address?: string;
};

export async function loginBusinessUser(payload: LoginPayload): Promise<AuthSession> {
  return apiRequest<AuthSession>("/auth/login", {
    method: "POST",
    body: {
      email: payload.email.toLowerCase().trim(),
      password: payload.password
    }
  });
}

export async function registerBusinessUser(
  payload: RegisterBusinessPayload
): Promise<AuthSession> {
  const username = buildBusinessUsername(payload.email, payload.businessName);

  const session = await apiRequest<AuthSession>("/auth/register", {
    method: "POST",
    body: {
      name: payload.ownerName.trim(),
      username,
      email: payload.email.toLowerCase().trim(),
      password: payload.password,
      role: "BUSINESS_OWNER"
    }
  });

  await apiRequest<BusinessResponse>("/businesses", {
    method: "POST",
    token: session.accessToken,
    body: {
      name: payload.businessName.trim(),
      address: payload.address.trim(),
      latitude: payload.latitude,
      longitude: payload.longitude
    }
  });

  return session;
}

function buildBusinessUsername(email: string, businessName: string) {
  const emailPrefix = email.split("@")[0] ?? "";
  const base = `${businessName}-${emailPrefix}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);

  return base.length >= 3 ? base : `negocio-${Date.now()}`;
}

export async function validateSession(session: AuthSession): Promise<AuthSession> {
  const user = await apiRequest<AuthUser>("/auth/me", {
    token: session.accessToken
  });

  return {
    ...session,
    user
  };
}
