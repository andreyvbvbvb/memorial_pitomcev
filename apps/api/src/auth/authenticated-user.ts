import type { Request } from "express";
import type { Role } from "@prisma/client";

export type AuthenticatedUser = {
  id: string;
  email: string;
  login: string | null;
  role: Role;
  preferredLanguage: string;
  coinBalance: number;
  maxMemorials: number | null;
};

export type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};
