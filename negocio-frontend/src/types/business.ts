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

export type BusinessCommissionSettlementStatus = "PENDING" | "CONFIRMED" | "CANCELLED";

export type BusinessCommissionSettlement = {
  id: string;
  businessId: string;
  ownerUserId: string;
  settlementWeek: string;
  periodStartAt: string;
  periodEndAt: string;
  status: BusinessCommissionSettlementStatus;
  orderCount: number;
  orderIds?: string[] | null;
  grossSalesCents: number;
  businessPayoutCents: number;
  rapivCommissionCents: number;
  businessNotifiedAt?: string | null;
  confirmedAt?: string | null;
  confirmedByUserId?: string | null;
};

export type BusinessProfile = {
  id?: string;
  name?: string;
  logo?: string | null;
  address?: string;
  acceptsCash?: boolean;
  acceptsCard?: boolean;
  stripeConnectedAccountId?: string | null;
  stripePlatformAccountId?: string | null;
  stripeChargesEnabled?: boolean;
  stripePayoutsEnabled?: boolean;
  stripeDetailsSubmitted?: boolean;
  stripeRequirementsCurrentlyDue?: string[] | null;
  alertsEnabled?: boolean;
  coordinates?: Coordinates;
};


export type UpdateBusinessPayload = {
  name: string;
  logo?: string;
  address: string;
  acceptsCash: boolean;
  acceptsCard: boolean;
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
