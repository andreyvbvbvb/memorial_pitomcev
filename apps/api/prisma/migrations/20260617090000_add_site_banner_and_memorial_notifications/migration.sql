-- AlterTable
ALTER TABLE "Memorial"
ADD COLUMN "dirtFullNotifiedAt" TIMESTAMP(3),
ADD COLUMN "expirationReminderSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SiteBanner" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "text" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteBanner_pkey" PRIMARY KEY ("id")
);
