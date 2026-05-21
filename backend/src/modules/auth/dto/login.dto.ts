import { IsEmail, IsString, MinLength } from "class-validator";
import type { LoginPayload } from "@rapidin/contracts";

export class LoginDto implements LoginPayload {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
