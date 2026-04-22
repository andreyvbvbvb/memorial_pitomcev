export type AccessLevel = "OWNER" | "ADMIN" | "USER";

export type AuthUser = {
  id: string;
  login?: string | null;
  email: string;
  coinBalance?: number;
  maxMemorials?: number | null;
  role?: "USER" | "ADMIN";
  accessLevel?: AccessLevel;
  termsAccepted?: boolean;
  offerAccepted?: boolean;
};

export const canAccessAdmin = (accessLevel?: AccessLevel | null) =>
  accessLevel === "OWNER" || accessLevel === "ADMIN";

export const canUseCalibration = (accessLevel?: AccessLevel | null) =>
  canAccessAdmin(accessLevel);

export const canManageAdmins = (accessLevel?: AccessLevel | null) =>
  accessLevel === "OWNER";
