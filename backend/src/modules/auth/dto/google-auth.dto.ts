import { IsOptional, IsString, MinLength } from "class-validator";

export class GoogleAuthDto {
  @IsString()
  @MinLength(20)
  idToken!: string;

  @IsOptional()
  @IsString()
  role?: string;
}
