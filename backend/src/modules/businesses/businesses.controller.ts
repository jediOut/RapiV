import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common";

import { CurrentUser } from "../../common/auth/current-user.decorator";
import { AuthenticatedUser } from "../../common/auth/jwt-auth.guard";
import { BusinessesService } from "./businesses.service";
import { CreateBusinessDto } from "./dto/create-business.dto";
import { UpdateBusinessDto } from "./dto/update-business.dto";

@Controller("businesses")
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Get()
  async findAll() {
    return this.businessesService.findAll();
  }

  @Get("mine")
  async findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.businessesService.findByOwner(user.sub);
  }

  @Get(":id")
  async findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.businessesService.findById(id);
  }

  @Post()
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBusinessDto) {
    return this.businessesService.create(user.sub, dto);
  }

  @Patch(":id")
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateBusinessDto
  ) {
    return this.businessesService.update(user.sub, id, dto);
  }
}
