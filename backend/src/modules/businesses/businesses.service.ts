import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";

import { UsersService } from "../users/users.service";

import { Business } from "./business.entity";
import { CreateBusinessDto } from "./dto/create-business.dto";
import { UpdateBusinessDto } from "./dto/update-business.dto";
import { assertInsideVegaServiceaddress } from "src/common/geo/vega-zone";

@Injectable()
export class BusinessesService {
  constructor(
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    private readonly dataSource: DataSource,
    private readonly usersService: UsersService
  ) {}

  async create(ownerUserId: string, dto: CreateBusinessDto): Promise<Business> {
    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      assertInsideVegaServiceaddress({
        latitude: dto.latitude,
        longitude: dto.longitude
      });
    }

    return this.dataSource.transaction(async (manager) => {
      await this.usersService.addRole(ownerUserId, "BUSINESS_OWNER", manager);

      const business = manager.create(Business, {
        ownerUserId,
        name: dto.name.trim(),
        address: dto.address?.trim(),
        logo: dto.logo?.trim(),
        latitude: dto.latitude,
        longitude: dto.longitude,
        acceptsCash: dto.acceptsCash ?? true,
        acceptsCard: false,
        stripeChargesEnabled: false,
        stripePayoutsEnabled: false,
        stripeDetailsSubmitted: false,
        minimumOrderItems: dto.minimumOrderItems ?? 1,
        isOpen: true
      });

      return manager.save(Business, business);
    });
  }

  async findAll(): Promise<Business[]> {
    return this.businessRepository.find({ relations: ['owner'] });
  }

  async findByOwner(ownerUserId: string): Promise<Business[]> {
    return this.businessRepository.find({
      where: { ownerUserId },
      relations: ['owner', 'products']
    });
  }

  async findById(id: string): Promise<Business> {
    const business = await this.businessRepository.findOne({
      where: { id },
      relations: ['owner', 'products']
    });

    if (!business) {
      throw new NotFoundException("Business not found");
    }

    return business;
  }

  async update(ownerUserId: string, businessId: string, dto: UpdateBusinessDto): Promise<Business> {
    const business = await this.findById(businessId);

    if (business.ownerUserId !== ownerUserId) {
      throw new ForbiddenException("User does not own this business");
    }

    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      assertInsideVegaServiceaddress({
        latitude: dto.latitude,
        longitude: dto.longitude
      });
    }

    if (dto.name !== undefined) {
      business.name = dto.name.trim();
    }

    if (dto.address !== undefined) {
      business.address = dto.address.trim();
    }

    if (dto.logo !== undefined) {
      business.logo = dto.logo.trim();
    }

    if (dto.latitude !== undefined) {
      business.latitude = dto.latitude;
    }

    if (dto.longitude !== undefined) {
      business.longitude = dto.longitude;
    }

    if (dto.isOpen !== undefined) {
      business.isOpen = dto.isOpen;
    }

    if (dto.acceptsCash !== undefined) {
      business.acceptsCash = dto.acceptsCash;
    }

    if (dto.acceptsCard === true) {
      this.assertStripeCardPaymentsReady(business);
      business.acceptsCard = true;
    } else if (dto.acceptsCard === false) {
      business.acceptsCard = dto.acceptsCard;
    }

    if (dto.minimumOrderItems !== undefined) {
      business.minimumOrderItems = dto.minimumOrderItems;
    }

    return this.businessRepository.save(business);
  }

  async createStripeConnectAccount(ownerUserId: string, businessId: string): Promise<Business> {
    const business = await this.findOwnedBusiness(ownerUserId, businessId);

    if (business.stripeConnectedAccountId) {
      return this.refreshStripeConnectStatus(ownerUserId, businessId);
    }

    const account = await this.stripeRequest<Record<string, unknown>>("/v1/accounts", {
      type: "express",
      country: "MX",
      email: business.owner?.email,
      "capabilities[card_payments][requested]": "true",
      "capabilities[transfers][requested]": "true",
      "business_profile[name]": business.name,
      "metadata[business_id]": business.id,
      "metadata[owner_user_id]": business.ownerUserId
    });

    const accountId = this.stringField(account, "id");

    if (!accountId) {
      throw new Error("Stripe did not return a connected account id");
    }

    business.stripeConnectedAccountId = accountId;
    business.stripeChargesEnabled = false;
    business.stripePayoutsEnabled = false;
    business.stripeDetailsSubmitted = false;
    business.stripeRequirementsCurrentlyDue = null;
    business.acceptsCard = false;

    return this.businessRepository.save(business);
  }

  async createStripeOnboardingLink(
    ownerUserId: string,
    businessId: string
  ): Promise<{ url: string; business: Business }> {
    let business = await this.findOwnedBusiness(ownerUserId, businessId);

    if (!business.stripeConnectedAccountId) {
      business = await this.createStripeConnectAccount(ownerUserId, businessId);
    }

    const appBaseUrl = process.env.BUSINESS_APP_URL ?? process.env.PUBLIC_APP_URL ?? "rapiv-negocio://stripe";
    const normalizedAppBaseUrl = appBaseUrl.replace(/\/$/, "");
    const link = await this.stripeRequest<Record<string, unknown>>("/v1/account_links", {
      account: business.stripeConnectedAccountId ?? "",
      type: "account_onboarding",
      refresh_url: `${normalizedAppBaseUrl}/stripe-refresh?businessId=${business.id}`,
      return_url: `${normalizedAppBaseUrl}/stripe-return?businessId=${business.id}`
    });
    const url = this.stringField(link, "url");

    if (!url) {
      throw new Error("Stripe did not return an onboarding URL");
    }

    return { url, business };
  }

  async refreshStripeConnectStatus(ownerUserId: string, businessId: string): Promise<Business> {
    const business = await this.findOwnedBusiness(ownerUserId, businessId);

    if (!business.stripeConnectedAccountId) {
      business.stripeChargesEnabled = false;
      business.stripePayoutsEnabled = false;
      business.stripeDetailsSubmitted = false;
      business.stripeRequirementsCurrentlyDue = null;
      business.acceptsCard = false;
      return this.businessRepository.save(business);
    }

    const account = await this.stripeGet<Record<string, unknown>>(
      `/v1/accounts/${encodeURIComponent(business.stripeConnectedAccountId)}`
    );
    const requirements = this.objectField(account, "requirements");
    const currentlyDue = requirements?.currently_due;

    business.stripeChargesEnabled = account.charges_enabled === true;
    business.stripePayoutsEnabled = account.payouts_enabled === true;
    business.stripeDetailsSubmitted = account.details_submitted === true;
    business.stripeRequirementsCurrentlyDue = Array.isArray(currentlyDue)
      ? currentlyDue.filter((item): item is string => typeof item === "string")
      : null;

    if (!business.stripeChargesEnabled) {
      business.acceptsCard = false;
    }

    return this.businessRepository.save(business);
  }

  private async findOwnedBusiness(ownerUserId: string, businessId: string): Promise<Business> {
    const business = await this.findById(businessId);

    if (business.ownerUserId !== ownerUserId) {
      throw new ForbiddenException("User does not own this business");
    }

    return business;
  }

  private assertStripeCardPaymentsReady(business: Business): void {
    if (!business.stripeConnectedAccountId || !business.stripeChargesEnabled) {
      throw new ConflictException("Configure Stripe Connect before accepting card payments");
    }
  }

  private async stripeRequest<T>(path: string, params: Record<string, string | undefined>): Promise<T> {
    const response = await fetch(`https://api.stripe.com${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.requireStripeSecretKey()}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams(
        Object.entries(params).filter((entry): entry is [string, string] => typeof entry[1] === "string")
      )
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Stripe Connect request failed with status ${response.status}: ${errorBody}`);
    }

    return response.json() as Promise<T>;
  }

  private async stripeGet<T>(path: string): Promise<T> {
    const response = await fetch(`https://api.stripe.com${path}`, {
      headers: {
        Authorization: `Bearer ${this.requireStripeSecretKey()}`
      }
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Stripe Connect lookup failed with status ${response.status}: ${errorBody}`);
    }

    return response.json() as Promise<T>;
  }

  private requireStripeSecretKey(): string {
    const apiKey = process.env.STRIPE_SECRET_KEY;

    if (!apiKey) {
      throw new Error("Missing STRIPE_SECRET_KEY");
    }

    return apiKey;
  }

  private stringField(source: Record<string, unknown>, key: string): string | undefined {
    const value = source[key];
    return typeof value === "string" ? value : undefined;
  }

  private objectField(source: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
    const value = source[key];
    return typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
  }
}
