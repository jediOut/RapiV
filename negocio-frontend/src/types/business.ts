import type {
  Business as ContractBusiness,
  BusinessOrder,
  Coordinates,
  CreateProductPayload,
  Product as ContractProduct
} from "@rapidin/contracts";

export type OrderStatus = "Nuevo" | "Preparando" | "Listo";
export type { BusinessOrder, Coordinates, CreateProductPayload };

export type Product = ContractProduct & {
  category: string;
};

export type Business = ContractBusiness & {
  address: string;
};

export type BusinessProfile = {
  name?: string;
  address?: string;
  paymentMode?: string;
  alertsEnabled?: boolean;
  coordinates?: Coordinates;
};


export type UpdateBusinessPayload = {
  name: string;
  address: string;
  paymentMode: string;
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
