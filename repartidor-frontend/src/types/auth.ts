import type {
  AuthSession as ContractAuthSession,
  CourierStripeConnectProfile,
  LoginPayload,
  RegisterPayload as ContractRegisterPayload,
  UserRole
} from "@rapidin/contracts";

export type User = ContractAuthSession["user"] & {
  fullName: string;
  roles?: UserRole[];
};

export type AuthResponse = Omit<ContractAuthSession, "user"> & {
  user: User;
};

export type AuthSession = AuthResponse;

export type { LoginPayload };
export type { CourierStripeConnectProfile };

export type RegisterPayload = Omit<ContractRegisterPayload, "name" | "fullName"> & {
  fullName: string;
  phone?: string;
};
