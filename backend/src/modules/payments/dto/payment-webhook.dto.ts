import { IsBoolean, IsNumber, IsObject, IsOptional, IsString } from "class-validator";

export class PaymentWebhookDto {
  @IsString()
  @IsOptional()
  id!: string;

  @IsString()
  @IsOptional()
  object?: string;

  @IsString()
  @IsOptional()
  action?: string;

  @IsString()
  @IsOptional()
  api_version?: string;

  @IsString()
  @IsOptional()
  date_created?: string;

  @IsNumber()
  @IsOptional()
  created?: number;

  @IsBoolean()
  @IsOptional()
  live_mode?: boolean;

  @IsBoolean()
  @IsOptional()
  livemode?: boolean;

  @IsNumber()
  @IsOptional()
  pending_webhooks?: number;

  @IsObject()
  @IsOptional()
  request?: Record<string, unknown> | null;

  @IsNumber()
  @IsOptional()
  user_id?: number;

  @IsString()
  type!:
    | "payment"
    | "payment.processing"
    | "payment.succeeded"
    | "payment.failed"
    | "payment.cancelled"
    | "checkout.session.completed"
    | "checkout.session.expired";

  @IsObject()
  data!: {
    providerPaymentId?: string;
    id?: string;
    object?: {
      id?: string;
      client_reference_id?: string;
      payment_status?: string;
      status?: string;
    };
    orderGroupId?: string;
    amountCents?: number;
    currency?: string;
  };
}
