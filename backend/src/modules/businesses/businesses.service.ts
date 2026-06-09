import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";

import { StripeConnectService } from "../stripe-connect/stripe-connect.service";
import { UsersService } from "../users/users.service";

import { Business } from "./business.entity";
import { CreateBusinessDto } from "./dto/create-business.dto";
import { UpdateBusinessDto } from "./dto/update-business.dto";
import { assertInsideVegaBusinessArea } from "src/common/geo/vega-zone";

@Injectable()
export class BusinessesService {
  constructor(
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    private readonly dataSource: DataSource,
    private readonly usersService: UsersService,
    private readonly stripeConnectService: StripeConnectService
  ) {}

  async create(ownerUserId: string, dto: CreateBusinessDto): Promise<Business> {
    this.assertBusinessLocation({
      latitude: dto.latitude,
      longitude: dto.longitude
    });

    const owner = await this.usersService.findById(ownerUserId);

    if (!owner.roles.includes("BUSINESS_OWNER")) {
      throw new ForbiddenException(
        "Este correo no esta registrado como cuenta de negocio. Crea una cuenta de negocio con otro correo."
      );
    }

    return this.dataSource.transaction(async (manager) => {
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

    if (
      dto.address !== undefined ||
      dto.latitude !== undefined ||
      dto.longitude !== undefined
    ) {
      this.assertBusinessLocation({
        latitude: dto.latitude ?? business.latitude,
        longitude: dto.longitude ?? business.longitude
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

    return this.businessRepository.save(business);
  }

  async createStripeConnectAccount(ownerUserId: string, businessId: string): Promise<Business> {
    let business = await this.findOwnedBusiness(ownerUserId, businessId);

    if (business.stripeConnectedAccountId) {
      business = await this.refreshStripeConnectStatusForBusiness(business);
      if (business.stripeConnectedAccountId) {
        return business;
      }
    }

    const account = await this.stripeConnectService.createExpressAccount({
      email: business.owner?.email,
      profileName: business.name,
      requestCardPayments: true,
      requestTransfers: true,
      fallbackPlatformAccountId: business.stripePlatformAccountId,
      metadata: {
        business_id: business.id,
        owner_user_id: business.ownerUserId
      }
    });

    business.stripeConnectedAccountId = account.accountId;
    business.stripePlatformAccountId = account.platformAccountId;
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

    if (business.stripeConnectedAccountId) {
      business = await this.refreshStripeConnectStatusForBusiness(business);
    }

    if (!business.stripeConnectedAccountId) {
      business = await this.createStripeConnectAccount(ownerUserId, businessId);
    }

    const normalizedAppBaseUrl = this.stripeConnectService.requireReturnBaseUrl({
      primaryEnvKey: "BUSINESS_APP_URL",
      fallbackEnvKey: "PUBLIC_API_URL",
      label: "BUSINESS_APP_URL or PUBLIC_API_URL"
    });
    const url = await this.stripeConnectService.createOnboardingLink({
      connectedAccountId: business.stripeConnectedAccountId ?? "",
      refreshUrl: `${normalizedAppBaseUrl}/stripe-refresh?businessId=${business.id}`,
      returnUrl: `${normalizedAppBaseUrl}/stripe-return?businessId=${business.id}`
    });

    return { url, business };
  }

  async refreshStripeConnectStatus(ownerUserId: string, businessId: string): Promise<Business> {
    const business = await this.findOwnedBusiness(ownerUserId, businessId);
    return this.refreshStripeConnectStatusForBusiness(business);
  }

  async refreshStripeConnectStatusFromReturn(businessId: string): Promise<Business> {
    const business = await this.findById(businessId);
    return this.refreshStripeConnectStatusForBusiness(business);
  }

  private async refreshStripeConnectStatusForBusiness(business: Business): Promise<Business> {

    if (!business.stripeConnectedAccountId) {
      return this.resetStripeConnectState(business);
    }

    const platformAccountId = await this.stripeConnectService.currentPlatformAccountId();

    if (!business.stripePlatformAccountId || business.stripePlatformAccountId !== platformAccountId) {
      return this.resetStripeConnectState(business);
    }

    let account;

    try {
      account = await this.stripeConnectService.retrieveAccountStatus(business.stripeConnectedAccountId);
    } catch (error) {
      if (this.stripeConnectService.isMissingResourceError(error)) {
        return this.resetStripeConnectState(business);
      }
      throw error;
    }

    business.stripePlatformAccountId = platformAccountId;
    business.stripeChargesEnabled = account.chargesEnabled;
    business.stripePayoutsEnabled = account.payoutsEnabled;
    business.stripeDetailsSubmitted = account.detailsSubmitted;
    business.stripeRequirementsCurrentlyDue = account.requirementsCurrentlyDue;

    if (!business.stripeChargesEnabled) {
      business.acceptsCard = false;
    }

    return this.businessRepository.save(business);
  }

  private resetStripeConnectState(business: Business): Promise<Business> {
    business.stripeConnectedAccountId = null;
    business.stripePlatformAccountId = null;
    business.stripeChargesEnabled = false;
    business.stripePayoutsEnabled = false;
    business.stripeDetailsSubmitted = false;
    business.stripeRequirementsCurrentlyDue = null;
    business.acceptsCard = false;
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

  private assertBusinessLocation(location: {
    latitude?: number | null;
    longitude?: number | null;
  }): void {
    if (location.latitude === undefined || location.longitude === undefined) {
      throw new BadRequestException("Business location coordinates are required");
    }

    assertInsideVegaBusinessArea({
      latitude: Number(location.latitude),
      longitude: Number(location.longitude)
    });
  }

}
