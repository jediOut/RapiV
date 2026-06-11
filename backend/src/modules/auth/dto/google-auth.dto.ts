import { Equals, IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class GoogleAuthDto {
  @IsString()
  @MinLength(20)
  idToken!: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @Equals(true, { message: "Debes aceptar los terminos y condiciones" })
  termsAccepted?: true;

  @IsOptional()
  @IsString()
  termsVersion?: string;

  @IsOptional()
  @IsIn(["cliente", "negocio", "repartidor"])
  termsApp?: "cliente" | "negocio" | "repartidor";
}
