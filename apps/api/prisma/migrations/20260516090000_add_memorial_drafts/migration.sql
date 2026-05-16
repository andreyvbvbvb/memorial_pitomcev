CREATE TABLE "MemorialDraft" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "species" TEXT,
    "birthDate" TIMESTAMP(3),
    "deathDate" TIMESTAMP(3),
    "epitaph" TEXT,
    "story" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "markerStyle" TEXT,
    "environmentId" TEXT,
    "houseId" TEXT,
    "sceneJson" JSONB,
    "step" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemorialDraft_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MemorialDraft_ownerId_updatedAt_idx" ON "MemorialDraft"("ownerId", "updatedAt");

ALTER TABLE "MemorialDraft" ADD CONSTRAINT "MemorialDraft_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
