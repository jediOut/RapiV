import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { User, UserRole } from "./user.entity";

type CreateUserInput = {
  email: string;
  username: string;
  name: string;
  phone?: string;
  passwordHash: string;
  roles: UserRole[];
  termsAcceptedAt?: Date;
  termsVersion?: string;
  termsApp?: string;
};

type UpdateUserInput = {
  email?: string;
  username?: string;
  fullName?: string;
  phone?: string;
  address?: string;
};

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(input: CreateUserInput): Promise<User> {
    const normalizedEmail = input.email.toLowerCase().trim();
    const normalizedUsername = this.normalizeUsername(input.username);

    const existingByEmail = await this.findByEmail(normalizedEmail);
    if (existingByEmail) {
      throw new ConflictException("Este correo ya esta registrado");
    }

    const existingByUsername = await this.findByUsername(normalizedUsername);
    if (existingByUsername) {
      throw new ConflictException("Este nombre de usuario ya esta registrado");
    }

    const user = this.userRepository.create({
      email: normalizedEmail,
      username: normalizedUsername,
      fullName: input.name.trim(),
      phone: input.phone?.trim() || undefined,
      passwordHash: input.passwordHash,
      roles: input.roles,
      termsAcceptedAt: input.termsAcceptedAt,
      termsVersion: input.termsVersion,
      termsApp: input.termsApp,
    });

    try {
      return await this.userRepository.save(user);
    } catch (error) {
      this.throwUniqueUserConflict(error);
      throw error;
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = email.toLowerCase().trim();
    return this.userRepository.findOne({ where: { email: normalizedEmail } });
  }

  async findByUsername(username: string): Promise<User | null> {
    const normalizedUsername = this.normalizeUsername(username);
    return this.userRepository.findOne({ where: { username: normalizedUsername } });
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return user;
  }

  async updateProfile(userId: string, input: UpdateUserInput): Promise<User> {
    const user = await this.findById(userId);

    if (input.email !== undefined) {
      const normalizedEmail = input.email.toLowerCase().trim();
      const existingByEmail = await this.findByEmail(normalizedEmail);

      if (existingByEmail && existingByEmail.id !== userId) {
        throw new ConflictException("Este correo ya esta registrado");
      }

      user.email = normalizedEmail;
    }

    if (input.username !== undefined) {
      const normalizedUsername = this.normalizeUsername(input.username);
      const existingByUsername = await this.findByUsername(normalizedUsername);

      if (existingByUsername && existingByUsername.id !== userId) {
        throw new ConflictException("Este nombre de usuario ya esta registrado");
      }

      user.username = normalizedUsername;
    }

    if (input.fullName !== undefined) {
      user.fullName = input.fullName.trim();
    }

    if (input.phone !== undefined) {
      user.phone = input.phone.trim() || undefined;
    }

    if (input.address !== undefined) {
      user.address = input.address.trim() || undefined;
    }

    try {
      return await this.userRepository.save(user);
    } catch (error) {
      this.throwUniqueUserConflict(error);
      throw error;
    }
  }

  private normalizeUsername(username: string): string {
    return username.toLowerCase().trim();
  }

  private throwUniqueUserConflict(error: unknown): void {
    if (
      typeof error !== "object" ||
      error === null ||
      !("code" in error) ||
      (error as { code?: string }).code !== "23505"
    ) {
      return;
    }

    const detail = "detail" in error && typeof (error as { detail?: unknown }).detail === "string"
      ? (error as { detail: string }).detail
      : "";

    if (detail.includes("email")) {
      throw new ConflictException("Este correo ya esta registrado");
    }

    if (detail.includes("username")) {
      throw new ConflictException("Este nombre de usuario ya esta registrado");
    }

    throw new ConflictException("Ya existe un usuario con esos datos");
  }
}
