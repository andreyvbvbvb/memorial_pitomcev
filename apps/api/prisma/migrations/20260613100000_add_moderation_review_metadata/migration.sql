ALTER TABLE "Pet" ADD COLUMN "moderationReviewType" TEXT NOT NULL DEFAULT 'INITIAL';
ALTER TABLE "Pet" ADD COLUMN "moderationChangedBlocks" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "Pet_moderationStatus_moderationReviewType_idx" ON "Pet"("moderationStatus", "moderationReviewType");
