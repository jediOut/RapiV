import { IsInt, Min } from "class-validator";

export class CreateCourierWalletTopUpDto {
  @IsInt()
  @Min(1)
  amountCents!: number;
}
