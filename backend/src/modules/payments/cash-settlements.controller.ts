import { Controller, ForbiddenException, Get, Param, Patch, Post, Query } from "@nestjs/common";

import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../common/auth/jwt-auth.guard";
import { CashSettlementsService } from "./cash-settlements.service";

@Controller("cash-settlements")
export class CashSettlementsController {
  constructor(private readonly cashSettlementsService: CashSettlementsService) {}

  @Get("courier/mine")
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query("date") settlementDate?: string
  ) {
    if (!user.roles.includes("COURIER")) {
      throw new ForbiddenException("Only couriers can access cash settlements");
    }

    return this.cashSettlementsService.findCourierSettlement(user.sub, settlementDate);
  }

  @Get()
  findDaily(
    @CurrentUser() user: AuthenticatedUser,
    @Query("date") settlementDate?: string
  ) {
    this.assertAdmin(user);
    return this.cashSettlementsService.findDailySettlements(settlementDate);
  }

  @Post("daily-run")
  runDaily(
    @CurrentUser() user: AuthenticatedUser,
    @Query("date") settlementDate?: string
  ) {
    this.assertAdmin(user);
    return this.cashSettlementsService.runDailySettlement(settlementDate);
  }

  @Patch(":settlementId/confirm")
  confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param("settlementId") settlementId: string
  ) {
    this.assertAdmin(user);
    return this.cashSettlementsService.confirmSettlement(settlementId, user.sub);
  }

  private assertAdmin(user: AuthenticatedUser): void {
    if (!user.roles.includes("ADMIN")) {
      throw new ForbiddenException("Only admins can manage cash settlements");
    }
  }
}
