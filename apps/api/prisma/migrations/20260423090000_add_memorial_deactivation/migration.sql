ALTER TABLE "Pet"
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "deactivatedAt" TIMESTAMP(3),
  ADD COLUMN "deactivationReason" TEXT;

ALTER TABLE "Memorial"
  ADD COLUMN "activeUntil" TIMESTAMP(3),
  ADD COLUMN "deactivatedAt" TIMESTAMP(3),
  ADD COLUMN "deactivationReason" TEXT,
  ADD COLUMN "needsPreviewRefresh" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "previewUpdatedAt" TIMESTAMP(3);

ALTER TABLE "GiftPlacement"
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "deactivatedAt" TIMESTAMP(3),
  ADD COLUMN "deactivationReason" TEXT;

UPDATE "Memorial"
SET "activeUntil" = NULLIF("sceneJson"->>'memorialPaidUntil', '')::TIMESTAMP(3)
WHERE "sceneJson" ? 'memorialPaidUntil'
  AND NULLIF("sceneJson"->>'memorialPaidUntil', '') IS NOT NULL;

CREATE INDEX "Pet_ownerId_isActive_idx" ON "Pet"("ownerId", "isActive");
CREATE INDEX "Memorial_activeUntil_deactivatedAt_idx" ON "Memorial"("activeUntil", "deactivatedAt");
CREATE INDEX "GiftPlacement_petId_isActive_expiresAt_idx" ON "GiftPlacement"("petId", "isActive", "expiresAt");
