import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";

import { CurrentUser } from "../../common/auth/current-user.decorator";
import { AuthenticatedUser } from "../../common/auth/jwt-auth.guard";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductAvailabilityDto } from "./dto/update-product-availability.dto";
import { ProductsService } from "./products.service";

@Controller("businesses/:businessId/products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("businessId") businessId: string,
    @Body() dto: CreateProductDto
  ) {
    return this.productsService.create(user.sub, businessId, dto);
  }

  @Get()
  async findByBusiness(@Param("businessId") businessId: string) {
    return this.productsService.findByBusiness(businessId);
  }

  @Patch(":productId/availability")
  async updateAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Param("businessId") businessId: string,
    @Param("productId") productId: string,
    @Body() dto: UpdateProductAvailabilityDto
  ) {
    return this.productsService.updateAvailability(user.sub, businessId, productId, dto.available);
  }
}

@Controller("products")
export class PublicProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async findAvailable() {
    return this.productsService.findAvailable();
  }
}
