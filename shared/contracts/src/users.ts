export type UserRole = "CUSTOMER" | "BUSINESS_OWNER" | "COURIER" | "ADMIN";

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  name: string;
  fullName?: string;
  phone?: string;
  address?: string;
  roles: UserRole[];
};

export type AuthSession = {
  accessToken: string;
  user: AuthUser;
};

export type CourierStripeConnectProfile = {
  userId: string;
  stripeConnectedAccountId?: string | null;
  stripePlatformAccountId?: string | null;
  stripeChargesEnabled?: boolean;
  stripePayoutsEnabled?: boolean;
  stripeDetailsSubmitted?: boolean;
  stripeRequirementsCurrentlyDue?: string[] | null;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  email: string;
  password: string;
  username: string;
  name?: string;
  fullName?: string;
  phone?: string;
  role?: UserRole | string;
  termsAccepted: true;
  termsVersion: string;
  termsApp: "cliente" | "negocio" | "repartidor";
};
