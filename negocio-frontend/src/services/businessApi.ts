import { apiRequest } from "./apiClient";
import type {
  Business,
  BusinessCommissionSettlement,
  CreateProductPayload,
  Product,
  UpdateProductPayload
} from "../types/business";

function finiteNumberOrUndefined(value: unknown) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
}

export async function fetchMyBusinesses(token: string): Promise<Business[]> {
  return apiRequest<Business[]>("/businesses/mine", { token });
}

export async function fetchBusinessCommissionSettlements(
  token: string,
  businessId: string
): Promise<BusinessCommissionSettlement[]> {
  return apiRequest<BusinessCommissionSettlement[]>(
    `/business-commission-settlements/businesses/${businessId}/mine`,
    { token }
  );
}

export async function createBusiness(
  token: string,
  payload: { name: string; address: string; latitude?: number; longitude?: number }
): Promise<Business> {
  return apiRequest<Business>("/businesses", {
    method: "POST",
    token,
    body: {
      name: payload.name.trim(),
      address: payload.address?.trim(),
      latitude: finiteNumberOrUndefined(payload.latitude),
      longitude: finiteNumberOrUndefined(payload.longitude)
    }
  });
}

export async function updateBusiness(
  token: string,
  businessId: string,
  payload: {
    name?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    isOpen?: boolean;
    logo?: string;
    acceptsCash?: boolean;
    acceptsCard?: boolean;
  }
): Promise<Business> {
  const body: Record<string, unknown> = {};

  if (payload.name !== undefined) {
    body.name = payload.name.trim();
  }

  if (payload.address !== undefined) {
    body.address = payload.address.trim();
  }

  const latitude = finiteNumberOrUndefined(payload.latitude);
  const longitude = finiteNumberOrUndefined(payload.longitude);

  if (latitude !== undefined) {
    body.latitude = latitude;
  }

  if (longitude !== undefined) {
    body.longitude = longitude;
  }

  if (payload.isOpen !== undefined) {
    body.isOpen = payload.isOpen;
  }

  if (payload.logo !== undefined) {
    body.logo = payload.logo;
  }

  if (payload.acceptsCash !== undefined) {
    body.acceptsCash = payload.acceptsCash;
  }

  if (payload.acceptsCard !== undefined) {
    body.acceptsCard = payload.acceptsCard;
  }

  return apiRequest<Business>(`/businesses/${businessId}`, {
    method: "PATCH",
    token,
    body
  });
}

export async function createStripeConnectAccount(
  token: string,
  businessId: string
): Promise<Business> {
  return apiRequest<Business>(`/businesses/${businessId}/stripe/connect-account`, {
    method: "POST",
    token
  });
}

export async function createStripeOnboardingLink(
  token: string,
  businessId: string
): Promise<{ url: string; business: Business }> {
  return apiRequest<{ url: string; business: Business }>(
    `/businesses/${businessId}/stripe/onboarding-link`,
    {
      method: "POST",
      token
    }
  );
}

export async function refreshStripeConnectStatus(
  token: string,
  businessId: string
): Promise<Business> {
  return apiRequest<Business>(`/businesses/${businessId}/stripe/refresh-status`, {
    method: "POST",
    token
  });
}

export async function fetchBusinessProducts(
  token: string,
  businessId: string
): Promise<Product[]> {
  return apiRequest<Product[]>(`/businesses/${businessId}/products`, { token });
}

export async function createBusinessProduct(
  token: string,
  businessId: string,
  payload: CreateProductPayload
): Promise<Product> {
  return apiRequest<Product>(`/businesses/${businessId}/products`, {
    method: "POST",
    token,
    body: payload
  });
}

export async function updateBusinessProduct(
  token: string,
  businessId: string,
  productId: string,
  payload: UpdateProductPayload
): Promise<Product> {
  return apiRequest<Product>(`/businesses/${businessId}/products/${productId}`, {
    method: "PATCH",
    token,
    body: payload
  });
}

export async function updateProductAvailability(
  token: string,
  businessId: string,
  productId: string,
  available: boolean
): Promise<Product> {
  return apiRequest<Product>(`/businesses/${businessId}/products/${productId}/availability`, {
    method: "PATCH",
    token,
    body: { available }
  });
}
