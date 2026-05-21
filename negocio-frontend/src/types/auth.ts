import type {
  AuthSession,
  AuthUser,
  LoginPayload,
  RegisterPayload
} from "@rapidin/contracts";

export type { AuthSession, AuthUser, LoginPayload };

export type RegisterBusinessPayload = Omit<RegisterPayload, "name" | "fullName" | "username"> & {
  ownerName: string;
  businessName: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
};
