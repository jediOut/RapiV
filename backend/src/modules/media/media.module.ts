import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Business } from "../businesses/business.entity";
import { Product } from "../products/product.entity";
import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";

@Module({
  imports: [TypeOrmModule.forFeature([Business, Product])],
  controllers: [MediaController],
  providers: [MediaService]
})
export class MediaModule {}
