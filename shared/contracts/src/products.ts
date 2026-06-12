export type Product = {
  id: string;
  businessId: string;
  name: string;
  description?: string | null;
  image?: string | null;
  category?: string | null;
  priceCents: number;
  minimumQuantityPerOrder: number;
  available: boolean;
  rating?: number | null;
  ratingCount?: number;
  stock?: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

export type CreateProductPayload = {
  name: string;
  description?: string;
  category: string;
  priceCents: number;
  minimumQuantityPerOrder?: number;
  image?: string;
};

export type UpdateProductPayload = Partial<CreateProductPayload>;

export type UpdateProductAvailabilityPayload = {
  available: boolean;
};
