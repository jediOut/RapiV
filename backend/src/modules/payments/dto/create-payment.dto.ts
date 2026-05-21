import { IsUUID } from "class-validator";

export class CreatePaymentDto {
  @IsUUID()
  orderGroupId!: string;
}
