import "reflect-metadata";

import * as assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { CURRENT_TERMS_VERSION } from "@rapidin/contracts";

import type { User, UserRole } from "../users/user.entity";
import { AuthService } from "./auth.service";

const existingUser: User = {
  id: "user-1",
  email: "cliente@example.com",
  username: "cliente",
  fullName: "Cliente",
  passwordHash: "salt:hash",
  roles: ["CUSTOMER" as UserRole],
  phone: undefined,
  address: undefined,
  businesses: [],
  orders: [],
  createdAt: new Date(),
  updatedAt: new Date()
};

describe("AuthService", () => {
  let service: AuthService;
  let createCalls: number;

  beforeEach(() => {
    createCalls = 0;

    service = new AuthService(
      {
        sign: () => "access-token"
      } as never,
      {
        findByEmail: async (email: string) =>
          email === existingUser.email ? { ...existingUser } : null,
        create: async () => {
          createCalls += 1;
          return { ...existingUser };
        },
        findByUsername: async () => null
      } as never
    );

    (
      service as unknown as {
        verifyGoogleIdToken: (idToken: string) => Promise<{ email: string; name: string }>;
      }
    ).verifyGoogleIdToken = async () => ({
      email: existingUser.email,
      name: existingUser.fullName
    });
  });

  it("rejects Google login when the existing email belongs to another app role", async () => {
    await assert.rejects(
      service.loginWithGoogle({ idToken: "token", role: "COURIER" }),
      ConflictException
    );

    assert.equal(createCalls, 0);
  });

  it("allows Google login when the existing email matches the requested app role", async () => {
    const response = await service.loginWithGoogle({
      idToken: "token",
      role: "CUSTOMER"
    });

    assert.equal(response.accessToken, "access-token");
    assert.deepEqual(response.user.roles, ["CUSTOMER"]);
    assert.equal(createCalls, 0);
  });

  it("rejects registration when terms are not accepted", async () => {
    await assert.rejects(
      service.register({
        email: "nuevo@example.com",
        username: "nuevo",
        fullName: "Nuevo Usuario",
        password: "password123",
        termsAccepted: undefined as never,
        termsVersion: CURRENT_TERMS_VERSION,
        termsApp: "cliente"
      }),
      BadRequestException
    );

    assert.equal(createCalls, 0);
  });
});
