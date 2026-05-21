import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

import { UsersService } from "../users/users.service";
import type { User, UserRole } from "../users/user.entity";
import type { LoginDto } from "./dto/login.dto";
import type { RegisterDto } from "./dto/register.dto";

@Injectable()
export class AuthService {
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

  async findSessionUser(userId: string) {
    const user = await this.usersService.findById(userId);

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
