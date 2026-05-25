import type {
  Business as ContractBusiness,
  BusinessOrder,
  Coordinates,
  CreateProductPayload,
  Product as ContractProduct,
  UpdateProductPayload
} from "@rapidin/contracts";

export type OrderStatus = "Nuevo" | "Preparando" | "Listo";
export type { BusinessOrder, Coordinates, CreateProductPayload, UpdateProductPayload };

export type Product = ContractProduct & {
  category: string;
};

export type Business = ContractBusiness & {
  address: string;
};

export type BusinessProfile = {
  id?: string;
  name?: string;
  logo?: string | null;
  address?: string;
  acceptsCash?: boolean;
  acceptsCard?: boolean;
  stripeConnectedAccountId?: string | null;
  stripeChargesEnabled?: boolean;
  stripePayoutsEnabled?: boolean;
  stripeDetailsSubmitted?: boolean;
  stripeRequirementsCurrentlyDue?: string[] | null;
  minimumOrderItems?: number;
  alertsEnabled?: boolean;
  coordinates?: Coordinates;
};


export type UpdateBusinessPayload = {
  name: string;
  logo?: string;
  address: string;
  acceptsCash: boolean;
  acceptsCard: boolean;
  minimumOrderItems: number;
  alertsEnabled: boolean;
  coordinates: Coordinates;
};

export type SettingsScreenProps = {
  businessProfile: BusinessProfile;
  isLoading: boolean;
  onSave: (
    payload: UpdateBusinessPayload
  ) => void;
};
