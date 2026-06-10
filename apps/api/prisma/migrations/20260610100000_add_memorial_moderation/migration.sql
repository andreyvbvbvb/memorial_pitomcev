ALTER TABLE "Pet"
ADD COLUMN "moderationStatus" TEXT NOT NULL DEFAULT 'APPROVED',
ADD COLUMN "moderationComment" TEXT,
ADD COLUMN "moderatedAt" TIMESTAMP(3),
ADD COLUMN "moderatorId" TEXT;

CREATE INDEX "Pet_moderationStatus_createdAt_idx" ON "Pet"("moderationStatus", "createdAt");
