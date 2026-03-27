-- CreateTable
CREATE TABLE "CharityTotals" (
    "id" TEXT NOT NULL,
    "totalAccrued" INTEGER NOT NULL DEFAULT 0,
    "totalPaid" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharityTotals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharityReport" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "photos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharityReport_pkey" PRIMARY KEY ("id")
);
