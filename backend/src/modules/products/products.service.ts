import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { BusinessesService } from "../businesses/businesses.service";
import { Business } from "../businesses/business.entity";
import { Product } from "./product.entity";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly businessesService: BusinessesService
  ) {}

  async create(ownerUserId: string, businessId: string, dto: CreateProductDto): Promise<Product> {
    const business = await this.assertBusinessOwner(ownerUserId, businessId);
    this.assertBusinessCanPublishProducts(business);

    const product = this.productRepository.create({
      businessId,
      name: dto.name.trim(),
      category: dto.category.trim(),
      description: dto.description?.trim(),
      image: dto.image?.trim(),
      priceCents: dto.priceCents,
      minimumQuantityPerOrder: dto.minimumQuantityPerOrder ?? 1,
      available: true,
      stock: 0
    });

    return this.productRepository.save(product);
  }

  async findByBusiness(businessId: string): Promise<Product[]> {
    await this.businessesService.findById(businessId);
    return this.productRepository.find({
      where: { businessId },
      relations: ['business']
    });
  }

  async findAvailable(): Promise<Product[]> {
    return this.productRepository
      .createQueryBuilder("product")
      .leftJoinAndSelect("product.business", "business")
      .where("product.available = :available", { available: true })
      .andWhere("business.stripeConnectedAccountId IS NOT NULL")
      .andWhere("business.stripeChargesEnabled = :stripeReady", { stripeReady: true })
      .andWhere("business.stripePayoutsEnabled = :stripeReady", { stripeReady: true })
      .orderBy("product.createdAt", "DESC")
      .getMany();
  }

  async findById(productId: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id: productId },
      relations: ['business']
    });

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    return product;
  }

  async updateAvailability(
    ownerUserId: string,
    businessId: string,
    productId: string,
    available: boolean
  ): Promise<Product> {
    const business = await this.assertBusinessOwner(ownerUserId, businessId);

    const product = await this.findById(productId);

    if (product.businessId !== businessId) {
      throw new NotFoundException("Product not found for business");
    }

    if (available) {
      this.assertBusinessCanPublishProducts(business);
    }

    product.available = available;
    return this.productRepository.save(product);
  }

  async update(
    ownerUserId: string,
    businessId: string,
    productId: string,
    dto: UpdateProductDto
  ): Promise<Product> {
    await this.assertBusinessOwner(ownerUserId, businessId);

    const product = await this.findById(productId);

    if (product.businessId !== businessId) {
      throw new NotFoundException("Product not found for business");
    }

    if (dto.name !== undefined) {
      product.name = dto.name.trim();
    }

    if (dto.category !== undefined) {
      product.category = dto.category.trim();
    }

    if (dto.description !== undefined) {
      product.description = dto.description.trim();
    }

    if (dto.priceCents !== undefined) {
      product.priceCents = dto.priceCents;
    }

    if (dto.minimumQuantityPerOrder !== undefined) {
      product.minimumQuantityPerOrder = dto.minimumQuantityPerOrder;
    }

    if (dto.image !== undefined) {
      product.image = dto.image.trim();
    }

    return this.productRepository.save(product);
  }

  private async assertBusinessOwner(ownerUserId: string, businessId: string): Promise<Business> {
    const business = await this.businessesService.findById(businessId);

    if (business.ownerUserId !== ownerUserId) {
      throw new ForbiddenException("User does not own this business");
    }

    return business;
  }

  private assertBusinessCanPublishProducts(business: Business): void {
    if (
      !business.stripeConnectedAccountId ||
      !business.stripeChargesEnabled ||
      !business.stripePayoutsEnabled
    ) {
      throw new ConflictException("Configure Stripe Connect before publishing products");
    }
  }
}
