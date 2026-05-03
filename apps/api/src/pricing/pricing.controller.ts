import { Controller, Get, Inject } from "@nestjs/common";
import { PricingService } from "./pricing.service";

@Controller("pricing")
export class PricingController {
  constructor(@Inject(PricingService) private readonly pricing: PricingService) {}

  @Get("memorial-plans")
  listMemorialPlans() {
    return this.pricing.listMemorialPlanPrices();
  }
}
