import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Business } from "./business.entity";
import { UsersModule } from "../users/users.module";
import { BusinessesController } from "./businesses.controller";
import { BusinessesService } from "./businesses.service";

@Module({
  imports: [TypeOrmModule.forFeature([Business]), UsersModule],
  controllers: [BusinessesController],
  providers: [BusinessesService],
  exports: [BusinessesService]
})
export class BusinessesModule {}
