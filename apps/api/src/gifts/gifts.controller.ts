import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
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

  @Post("pets/:id/gifts")
  placeGift(@Param("id") petId: string, @Body() dto: CreateGiftPlacementDto) {
    return this.giftsService.placeGift({
      petId,
      ownerId: dto.ownerId,
      giftId: dto.giftId,
      slotName: dto.slotName,
      months: dto.months,
      size: dto.size
    });
  }
}
