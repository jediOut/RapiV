import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";

import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../common/auth/jwt-auth.guard";
import type { RatingTargetType } from "@rapidin/contracts";
import { CreateRatingDto } from "./dto/create-rating.dto";
import { UpdateRatingDto } from "./dto/update-rating.dto";
import { RatingsService } from "./ratings.service";

@Controller("ratings")
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRatingDto) {
    return this.ratingsService.create(user.sub, dto);
  }

  @Patch(":ratingId")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("ratingId") ratingId: string,
    @Body() dto: UpdateRatingDto
  ) {
    return this.ratingsService.update(user.sub, ratingId, dto);
  }

  @Get("mine")
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.ratingsService.findByCustomer(user.sub);
  }

  @Get("mine/orders/:orderGroupId")
  findMineByOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param("orderGroupId") orderGroupId: string
  ) {
    return this.ratingsService.findByOrderForCustomer(user.sub, orderGroupId);
  }

  @Get("targets/:targetType/:targetId")
  findByTarget(
    @Param("targetType") targetType: string,
    @Param("targetId") targetId: string
  ) {
    return this.ratingsService.findByTarget(this.parseTargetType(targetType), targetId);
  }

  @Get("summary")
  summary(
    @Query("targetType") targetType: string,
    @Query("targetId") targetId: string
  ) {
    return this.ratingsService.summaryForTarget(this.parseTargetType(targetType), targetId);
  }

  private parseTargetType(value: string): RatingTargetType {
    if (value === "BUSINESS" || value === "COURIER") {
      return value;
    }

    throw new BadRequestException("Invalid rating target type");
  }
}
