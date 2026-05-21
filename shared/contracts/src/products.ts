export type Product = {
  id: string;
  businessId: string;
  name: string;
  description?: string | null;
  image?: string | null;
  category?: string | null;
  priceCents: number;
  available: boolean;
  stock?: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

export type CreateProductPayload = {
  name: string;
  category: string;
  priceCents: number;
  image?: string;
};

export type UpdateProductAvailabilityPayload = {
  available: boolean;
};
