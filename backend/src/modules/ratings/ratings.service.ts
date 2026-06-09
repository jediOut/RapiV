import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import type { RatingSummary, RatingTargetType } from "@rapidin/contracts";
import { Business } from "../businesses/business.entity";
import { Order } from "../orders/order.entity";
import { CreateRatingDto } from "./dto/create-rating.dto";
import { UpdateRatingDto } from "./dto/update-rating.dto";
import { Rating } from "./rating.entity";

@Injectable()
export class RatingsService {
  constructor(
    @InjectRepository(Rating)
    private readonly ratingRepository: Repository<Rating>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>
  ) {}

  async create(customerId: string, dto: CreateRatingDto): Promise<Rating> {
    const orders = await this.orderRepository.find({
      where: { orderGroupId: dto.orderGroupId }
    });

    if (!orders.length) {
      throw new NotFoundException("Order not found");
    }

    if (orders.some((order) => order.userId !== customerId)) {
      throw new ForbiddenException("Only the customer can rate this order");
    }

    if (!orders.every((order) => order.status === "DELIVERED")) {
      throw new ConflictException("Order must be delivered before rating");
    }

    this.assertTargetBelongsToOrder(orders, dto.targetType, dto.targetId);

    const existing = await this.ratingRepository.findOne({
      where: {
        orderGroupId: dto.orderGroupId,
        targetType: dto.targetType,
        targetId: dto.targetId
      }
    });

    if (existing) {
      throw new ConflictException("This target was already rated for this order");
    }

    const rating = this.ratingRepository.create({
      orderGroupId: dto.orderGroupId,
      customerId,
      targetType: dto.targetType,
      targetId: dto.targetId,
      score: dto.score,
      comment: dto.comment?.trim() || null
    });

    const saved = await this.ratingRepository.save(rating);

    if (dto.targetType === "BUSINESS") {
      await this.updateBusinessRating(dto.targetId);
    }

    return saved;
  }

  async findByTarget(targetType: RatingTargetType, targetId: string): Promise<Rating[]> {
    return this.ratingRepository.find({
      where: { targetType, targetId },
      order: { createdAt: "DESC" }
    });
  }

  async summaryForTarget(targetType: RatingTargetType, targetId: string): Promise<RatingSummary> {
    const ratings = await this.findByTarget(targetType, targetId);

    if (!ratings.length) {
      return { average: null, count: 0 };
    }

    const average = ratings.reduce((sum, rating) => sum + rating.score, 0) / ratings.length;
    return { average: Number(average.toFixed(2)), count: ratings.length };
  }

  async findByOrderForCustomer(customerId: string, orderGroupId: string): Promise<Rating[]> {
    return this.ratingRepository.find({
      where: { customerId, orderGroupId },
      order: { createdAt: "DESC" }
    });
  }

  async findByCustomer(customerId: string): Promise<Rating[]> {
    return this.ratingRepository.find({
      where: { customerId },
      order: { createdAt: "DESC" },
      take: 50
    });
  }

  async update(customerId: string, ratingId: string, dto: UpdateRatingDto): Promise<Rating> {
    const rating = await this.ratingRepository.findOne({ where: { id: ratingId } });

    if (!rating) {
      throw new NotFoundException("Rating not found");
    }

    if (rating.customerId !== customerId) {
      throw new ForbiddenException("Only the customer can edit this rating");
    }

    if (rating.editCount >= 1) {
      throw new ConflictException("This rating can only be edited once");
    }

    rating.score = dto.score;
    rating.comment = dto.comment?.trim() || null;
    rating.editCount += 1;

    const saved = await this.ratingRepository.save(rating);

    if (saved.targetType === "BUSINESS") {
      await this.updateBusinessRating(saved.targetId);
    }

    return saved;
  }

  private assertTargetBelongsToOrder(
    orders: Order[],
    targetType: RatingTargetType,
    targetId: string
  ): void {
    if (targetType === "BUSINESS") {
      if (!orders.some((order) => order.businessId === targetId)) {
        throw new ForbiddenException("Business does not belong to this order");
      }
      return;
    }

    const courierId = orders[0]?.courierId;

    if (!courierId || courierId !== targetId || orders.some((order) => order.courierId !== targetId)) {
      throw new ForbiddenException("Courier does not belong to this order");
    }
  }

  private async updateBusinessRating(businessId: string): Promise<void> {
    const summary = await this.summaryForTarget("BUSINESS", businessId);
    await this.businessRepository.update(
      { id: businessId },
      { rating: summary.average }
    );
  }
}
