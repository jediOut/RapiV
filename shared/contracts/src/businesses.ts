export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type Business = {
  id: string;
  ownerUserId?: string;
  name: string;
  description?: string | null;
  logo?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  rating?: number | null;
  deliveryTime?: number | null;
  minimumOrder?: number | null;
  isOpen?: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

export type CreateBusinessPayload = {
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  logo?: string;
};
