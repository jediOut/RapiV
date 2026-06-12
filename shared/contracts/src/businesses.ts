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
  ratingCount?: number;
  deliveryTime?: number | null;
  minimumOrder?: number | null;
  acceptsCash?: boolean;
  acceptsCard?: boolean;
  stripeConnectedAccountId?: string | null;
  stripePlatformAccountId?: string | null;
  stripeChargesEnabled?: boolean;
  stripePayoutsEnabled?: boolean;
  stripeDetailsSubmitted?: boolean;
  stripeRequirementsCurrentlyDue?: string[] | null;
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
  acceptsCash?: boolean;
  acceptsCard?: boolean;
};
