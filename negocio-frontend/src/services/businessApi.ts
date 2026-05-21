import { apiRequest } from "./apiClient";
import type { Business, CreateProductPayload, Product, UpdateProductPayload } from "../types/business";

export async function fetchMyBusinesses(token: string): Promise<Business[]> {
  return apiRequest<Business[]>("/businesses/mine", { token });
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
      latitude: payload.latitude,
      longitude: payload.longitude
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
  }
): Promise<Business> {
  return apiRequest<Business>(
    `/businesses/${businessId}`,
    {
      method: "PATCH",
      token,
      body: {
        name: payload.name?.trim(),

        address:
          payload.address?.trim(),

        latitude:
          payload.latitude,

        longitude:
          payload.longitude,

        isOpen:
          payload.isOpen,

        logo:
          payload.logo
      }
    }
  );
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
