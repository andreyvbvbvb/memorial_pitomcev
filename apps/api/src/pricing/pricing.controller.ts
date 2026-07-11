import { Controller, Get, Inject } from "@nestjs/common";
import { PricingService } from "./pricing.service";

@Controller("pricing")
export class PricingController {
  constructor(@Inject(PricingService) private readonly pricing: PricingService) {}

  @Get("memorial-plans")
  listMemorialPlans() {
    return this.pricing.listMemorialPlanPrices();
  }

  @Get("memorial-publication-mode")
  getMemorialPublicationMode() {
    return this.pricing.getMemorialPublicationMode();
  }

  @Get("wallet-payment-mode")
  getWalletPaymentMode() {
    return this.pricing.getWalletPaymentMode();
  }
}
