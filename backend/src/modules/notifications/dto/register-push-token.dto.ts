import { IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class RegisterPushTokenDto {
  @IsString()
  @MinLength(10)
  token!: string;

  @IsIn(["cliente", "negocio", "repartidor"])
  app!: "cliente" | "negocio" | "repartidor";

  @IsOptional()
  @IsString()
  deviceId?: string;
}
