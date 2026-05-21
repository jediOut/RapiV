import { IsBoolean, IsNumber, IsObject, IsOptional, IsString } from "class-validator";

export class PaymentWebhookDto {
  @IsString()
  @IsOptional()
  id!: string;

  @IsString()
  @IsOptional()
  action?: string;

  @IsString()
  @IsOptional()
  api_version?: string;

  @IsString()
  @IsOptional()
  date_created?: string;

  @IsBoolean()
  @IsOptional()
  live_mode?: boolean;

  @IsNumber()
  @IsOptional()
  user_id?: number;

  @IsString()
  type!: "payment" | "payment.processing" | "payment.succeeded" | "payment.failed" | "payment.cancelled";

  @IsObject()
  data!: {
    providerPaymentId?: string;
    id?: string;
    orderGroupId?: string;
    amountCents?: number;
    currency?: string;
  };
}
