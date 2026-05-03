import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import type { AuthenticatedRequest } from "./authenticated-user";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.cookies?.access_token;
    const user = await this.authService.getUserFromToken(token);
    if (!user) {
      throw new UnauthorizedException("Не авторизован");
    }
    request.user = user;
    return true;
  }
}
