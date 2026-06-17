CREATE TABLE "ModelMetadata" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelMetadata_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModelMetadata_category_modelId_key" ON "ModelMetadata"("category", "modelId");
CREATE INDEX "ModelMetadata_category_idx" ON "ModelMetadata"("category");
