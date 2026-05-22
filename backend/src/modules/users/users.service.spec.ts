import "reflect-metadata";

import * as assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { ConflictException } from "@nestjs/common";

import { User, UserRole } from "./user.entity";
import { UsersService } from "./users.service";

type RepositoryMock = {
  findOne: (options: { where: Partial<User> }) => Promise<User | null>;
  create: (input: Partial<User>) => User;
  save: (user: User) => Promise<User>;
};

const baseUser: User = {
  id: "user-1",
  email: "old@example.com",
  username: "olduser",
  fullName: "Old User",
  passwordHash: "hash",
  roles: ["CUSTOMER" as UserRole],
  phone: undefined,
  address: undefined,
  businesses: [],
  orders: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("UsersService", () => {
  let users: User[];
  let repository: RepositoryMock;
  let service: UsersService;

  beforeEach(() => {
    users = [{ ...baseUser }];
    repository = {
      findOne: async ({ where }) =>
        users.find((user) =>
          Object.entries(where).every(([key, value]) => user[key as keyof User] === value)
        ) ?? null,
      create: (input) => ({ ...baseUser, ...input, id: "new-user" }),
      save: async (user) => {
        const existingIndex = users.findIndex((stored) => stored.id === user.id);

        if (users.some((stored) => stored.id !== user.id && stored.email === user.email)) {
          throw { code: "23505", detail: "Key (email) already exists." };
        }

        if (users.some((stored) => stored.id !== user.id && stored.username === user.username)) {
          throw { code: "23505", detail: "Key (username) already exists." };
        }

        if (existingIndex >= 0) {
          users[existingIndex] = user;
        } else {
          users.push(user);
        }

        return user;
      },
    };
    service = new UsersService(repository as never);
  });

  it("rejects duplicate emails during registration", async () => {
    await assert.rejects(
      service.create({
        email: "OLD@example.com",
        username: "newuser",
        name: "New User",
        passwordHash: "hash",
        roles: ["CUSTOMER" as UserRole],
      }),
      ConflictException
    );
  });

  it("rejects duplicate usernames during registration", async () => {
    await assert.rejects(
      service.create({
        email: "new@example.com",
        username: "OLDUSER",
        name: "New User",
        passwordHash: "hash",
        roles: ["CUSTOMER" as UserRole],
      }),
      ConflictException
    );
  });

  it("rejects duplicate emails when updating a profile", async () => {
    users.push({
      ...baseUser,
      id: "user-2",
      email: "taken@example.com",
      username: "taken",
    });

    await assert.rejects(
      service.updateProfile("user-1", { email: "TAKEN@example.com" }),
      ConflictException
    );
  });
});
