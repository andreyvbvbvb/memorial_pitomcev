type UserLike = {
  email?: string | null;
  login?: string | null;
  role?: string | null;
};

export const OWNER_EMAIL = "andreyvbvbvb@gmail.com";
export const OWNER_LOGIN = "andreyvbvbvb";

export type AccessLevel = "OWNER" | "ADMIN" | "USER";

export const isOwnerUser = (user?: UserLike | null) => {
  const email = user?.email?.trim().toLowerCase() ?? "";
  const login = user?.login?.trim().toLowerCase() ?? "";
  return email === OWNER_EMAIL || login === OWNER_LOGIN;
};

export const getAccessLevel = (user?: UserLike | null): AccessLevel => {
  if (isOwnerUser(user)) {
    return "OWNER";
  }
  if (user?.role === "ADMIN") {
    return "ADMIN";
  }
  return "USER";
};

export const canAccessAdmin = (user?: UserLike | null) => {
  const level = getAccessLevel(user);
  return level === "OWNER" || level === "ADMIN";
};

export const canManageAdmins = (user?: UserLike | null) => getAccessLevel(user) === "OWNER";
