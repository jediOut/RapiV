import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Product } from "./product.entity";
import { BusinessesModule } from "../businesses/businesses.module";
import { ProductsController, PublicProductsController } from "./products.controller";
import { ProductsService } from "./products.service";

@Module({
  imports: [TypeOrmModule.forFeature([Product]), BusinessesModule],
  controllers: [ProductsController, PublicProductsController],
  providers: [ProductsService],
  exports: [ProductsService]
})
export class ProductsModule {}
