import type {
  AuthSession as ContractAuthSession,
  LoginPayload,
  RegisterPayload as ContractRegisterPayload,
  UserRole
} from "@rapidin/contracts";

export type User = ContractAuthSession["user"] & {
  fullName?: string;
  name?: string;
  roles?: UserRole[];
};

export type AuthResponse = Omit<ContractAuthSession, "user"> & {
  user: User;
};

export type AuthSession = AuthResponse;

export type { LoginPayload };

export type RegisterPayload = Omit<ContractRegisterPayload, "name" | "fullName"> & {
  fullName: string;
  phone?: string;
};
