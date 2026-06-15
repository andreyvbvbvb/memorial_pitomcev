CREATE TABLE "EmailVerificationCode" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationCode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailVerificationCode_email_consumedAt_idx" ON "EmailVerificationCode"("email", "consumedAt");
CREATE INDEX "EmailVerificationCode_expiresAt_idx" ON "EmailVerificationCode"("expiresAt");
