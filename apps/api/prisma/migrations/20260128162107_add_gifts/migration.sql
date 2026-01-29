-- CreateTable
CREATE TABLE "GiftCatalog" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "modelUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftPlacement" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "giftId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "slotName" TEXT NOT NULL,
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "GiftPlacement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GiftCatalog_code_key" ON "GiftCatalog"("code");

-- CreateIndex
CREATE INDEX "GiftPlacement_petId_slotName_idx" ON "GiftPlacement"("petId", "slotName");

-- AddForeignKey
ALTER TABLE "GiftPlacement" ADD CONSTRAINT "GiftPlacement_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftPlacement" ADD CONSTRAINT "GiftPlacement_giftId_fkey" FOREIGN KEY ("giftId") REFERENCES "GiftCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftPlacement" ADD CONSTRAINT "GiftPlacement_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
