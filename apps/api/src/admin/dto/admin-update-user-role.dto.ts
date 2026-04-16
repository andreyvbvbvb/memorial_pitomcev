import { IsEmail, IsIn } from "class-validator";

export class AdminUpdateUserRoleDto {
  @IsEmail()
  email!: string;

  @IsIn(["USER", "ADMIN"])
  role!: "USER" | "ADMIN";
}
