import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
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
        acceptsCard: dto.acceptsCard ?? true,
        stripeConnectedAccountId: dto.stripeConnectedAccountId?.trim(),
        stripeChargesEnabled: dto.stripeChargesEnabled ?? false,
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

    if (dto.acceptsCard !== undefined) {
      business.acceptsCard = dto.acceptsCard;
    }

    if (dto.stripeConnectedAccountId !== undefined) {
      business.stripeConnectedAccountId = dto.stripeConnectedAccountId.trim();
    }

    if (dto.stripeChargesEnabled !== undefined) {
      business.stripeChargesEnabled = dto.stripeChargesEnabled;
    }

    if (dto.minimumOrderItems !== undefined) {
      business.minimumOrderItems = dto.minimumOrderItems;
    }

    return this.businessRepository.save(business);
  }
}
