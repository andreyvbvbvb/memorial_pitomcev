import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException
} from "@nestjs/common";
import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

@Controller("auth")
export class AuthController {
  private readonly authService: AuthService;

  constructor(@Inject(AuthService) authService: AuthService) {
    this.authService = authService;
  }

  private setAuthCookie(res: Response, token: string) {
    const secure = process.env.NODE_ENV === "production";
    const sameSite = secure ? "none" : "lax";
    res.cookie("access_token", token, {
      httpOnly: true,
      sameSite,
      secure,
      maxAge: 1000 * 60 * 60 * 24 * 7
    });
  }

  @Post("register")
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.authService.register(dto);
    const token = this.authService.signToken({ id: user.id, email: user.email });
    this.setAuthCookie(res, token);
    return {
      id: user.id,
      login: user.login,
      email: user.email,
      coinBalance: user.coinBalance
    };
  }

  @Post("login")
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.authService.login(dto);
    const token = this.authService.signToken({ id: user.id, email: user.email });
    this.setAuthCookie(res, token);
    return {
      id: user.id,
      login: user.login,
      email: user.email,
      coinBalance: user.coinBalance
    };
  }

  @Post("forgot")
  async forgot(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.identifier);
  }

  @Post("logout")
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie("access_token");
    return { ok: true };
  }

  @Get("me")
  async me(@Req() req: Request) {
    const token = req.cookies?.access_token;
    const user = await this.authService.getUserFromToken(token);
    if (!user) {
      throw new UnauthorizedException("Не авторизован");
    }
    return {
      id: user.id,
      login: user.login,
      email: user.email,
      coinBalance: user.coinBalance
    };
  }
}
