import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { OAuth2Client } from "google-auth-library";
import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

import { UsersService } from "../users/users.service";
import type { User, UserRole } from "../users/user.entity";
import type { GoogleAuthDto } from "./dto/google-auth.dto";
import type { LoginDto } from "./dto/login.dto";
import type { RegisterDto } from "./dto/register.dto";
import type { UpdateProfileDto } from "./dto/update-profile.dto";

@Injectable()
export class AuthService {
  private readonly googleClient = new OAuth2Client();

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService
  ) {}

  async register(dto: RegisterDto) {
    const role = this.normalizeRole(dto.role);
    const name = dto.fullName ?? dto.name;

    if (!name) {
      throw new BadRequestException("Name is required");
    }

    const user = await this.usersService.create({
      email: dto.email,
      username: dto.username,
      name,
      phone: dto.phone,
      passwordHash: this.hashPassword(dto.password),
      roles: role ? [role] : ["CUSTOMER"]
    });

    return this.buildAuthResponse(user);
  }

  private normalizeRole(role?: string): UserRole | undefined {
    if (!role) {
      return undefined;
    }

    const normalized = role.trim().toUpperCase();
    if (normalized === "DELIVERY") {
      return "COURIER";
    }
    if (normalized === "COURIER") {
      return "COURIER";
    }
    if (normalized === "BUSINESS") {
      return "BUSINESS_OWNER";
    }
    if (normalized === "BUSINESS_OWNER") {
      return "BUSINESS_OWNER";
    }
    if (normalized === "ADMIN") {
      return "ADMIN";
    }

    return undefined;
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user || !this.verifyPassword(dto.password, user.passwordHash)) {
      throw new UnauthorizedException("Invalid credentials");
    }

    return this.buildAuthResponse(user);
  }

  async loginWithGoogle(dto: GoogleAuthDto) {
    const role = this.normalizeRole(dto.role) ?? "CUSTOMER";
    const googleUser = await this.verifyGoogleIdToken(dto.idToken);
    let user = await this.usersService.findByEmail(googleUser.email);

    if (user) {
      if (!user.roles.includes(role)) {
        throw new ConflictException(
          "Este correo ya esta registrado para otra app. Usa otro correo o inicia sesion en la app correspondiente."
        );
      }

      return this.buildAuthResponse(user);
    }

    user = await this.usersService.create({
      email: googleUser.email,
      username: await this.buildAvailableUsername(googleUser.email),
      name: googleUser.name,
      passwordHash: this.hashPassword(randomBytes(32).toString("hex")),
      roles: [role]
    });

    return this.buildAuthResponse(user);
  }

  async findSessionUser(userId: string) {
    const user = await this.usersService.findById(userId);

    return this.toSessionUser(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.usersService.updateProfile(userId, dto);

    return this.toSessionUser(user);
  }

  private toSessionUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.fullName,
      fullName: user.fullName,
      phone: user.phone,
      address: user.address,
      roles: user.roles
    };
  }

  private buildAuthResponse(user: User) {
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      roles: user.roles
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.fullName,
        fullName: user.fullName,
        phone: user.phone,
        address: user.address,
        roles: user.roles
      }
    };
  }

  private async verifyGoogleIdToken(idToken: string) {
    const clientIds = this.getGoogleClientIds();

    if (clientIds.length === 0) {
      throw new BadRequestException("Google Sign-In no esta configurado");
    }

    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: clientIds
      });
      const payload = ticket.getPayload();

      if (!payload?.email || payload.email_verified !== true) {
        throw new UnauthorizedException("No se pudo verificar tu cuenta de Google");
      }

      return {
        email: payload.email.toLowerCase().trim(),
        name: payload.name?.trim() || payload.email.split("@")[0]
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException("Token de Google invalido");
    }
  }

  private getGoogleClientIds(): string[] {
    return [
      process.env.GOOGLE_CLIENT_IDS,
      process.env.GOOGLE_WEB_CLIENT_ID,
      process.env.GOOGLE_IOS_CLIENT_ID,
      process.env.GOOGLE_ANDROID_CLIENT_ID
    ]
      .flatMap((value) => value?.split(",") ?? [])
      .map((value) => value.trim())
      .filter(Boolean);
  }

  private async buildAvailableUsername(email: string): Promise<string> {
    const [localPart] = email.split("@");
    const base = localPart
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "")
      .replace(/^[._-]+|[._-]+$/g, "")
      .slice(0, 24) || "google";

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const suffix = attempt === 0 ? "" : `-${attempt + 1}`;
      const candidate = `${base}${suffix}`;

      if (!(await this.usersService.findByUsername(candidate))) {
        return candidate;
      }
    }

    return `${base}-${randomBytes(4).toString("hex")}`;
  }

  private hashPassword(password: string): string {
    const salt = randomBytes(16).toString("hex");
    const hash = pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
    return `${salt}:${hash}`;
  }

  private verifyPassword(password: string, storedHash: string): boolean {
    const [salt, hash] = storedHash.split(":");
    const candidate = pbkdf2Sync(password, salt, 100000, 64, "sha512");
    return timingSafeEqual(Buffer.from(hash, "hex"), candidate);
  }
}
