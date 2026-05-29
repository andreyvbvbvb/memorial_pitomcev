import { Body, Controller, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { GiftsService } from "./gifts.service";
import { CreateGiftPlacementDto } from "./dto/create-gift-placement.dto";

@Controller()
export class GiftsController {
  private readonly giftsService: GiftsService;

  constructor(@Inject(GiftsService) giftsService: GiftsService) {
    this.giftsService = giftsService;
  }

  @Get("gifts")
  listCatalog() {
    return this.giftsService.listCatalog();
  }

  @Get("users/me/gifts")
  @UseGuards(AuthGuard)
  listMyGifts(@CurrentUser() user: AuthenticatedUser) {
    return this.giftsService.listUserGifts(user.id);
  }

  @Post("pets/:id/gifts")
  @UseGuards(AuthGuard)
  placeGift(
    @Param("id") petId: string,
    @Body() dto: CreateGiftPlacementDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.giftsService.placeGift({
      petId,
      ownerId: user.id,
      giftId: dto.giftId,
      slotName: dto.slotName,
      months: dto.months,
      size: dto.size
    });
  }
}
