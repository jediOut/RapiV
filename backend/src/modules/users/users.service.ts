import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";

import { User, UserRole } from "./user.entity";

type CreateUserInput = {
  email: string;
  username: string;
  name: string;
  phone?: string;
  passwordHash: string;
  roles: UserRole[];
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
    });

    return this.userRepository.save(user);
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

  async addRole(userId: string, role: UserRole, manager?: EntityManager): Promise<User> {
    const repository = manager?.getRepository(User) ?? this.userRepository;
    const user = await repository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (!user.roles.includes(role)) {
      user.roles.push(role);
      return repository.save(user);
    }

    return user;
  }

  private normalizeUsername(username: string): string {
    return username.toLowerCase().trim();
  }
}
