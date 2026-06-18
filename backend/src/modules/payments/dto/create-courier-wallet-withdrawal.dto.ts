import { IsInt, Min } from "class-validator";

export class CreateCourierWalletWithdrawalDto {
  @IsInt()
  @Min(1)
  amountCents!: number;
}
