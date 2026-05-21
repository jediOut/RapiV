import { IsEmail, IsOptional, IsString, MinLength, ValidateIf } from "class-validator";
import type { RegisterPayload } from "@rapidin/contracts";

export class RegisterDto implements RegisterPayload {
  @ValidateIf((dto: RegisterDto) => !dto.fullName)
  @IsString()
  @MinLength(2)
  name?: string;

  @ValidateIf((dto: RegisterDto) => !dto.name)
  @IsString()
  @MinLength(2)
  fullName?: string;

  @IsString()
  @MinLength(3)
  username!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
