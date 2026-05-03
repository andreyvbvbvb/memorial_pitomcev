CREATE TABLE "MemorialPlanPrice" (
    "years" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemorialPlanPrice_pkey" PRIMARY KEY ("years")
);

INSERT INTO "MemorialPlanPrice" ("years", "price")
VALUES
  (0, 1500),
  (1, 100),
  (2, 200),
  (5, 500)
ON CONFLICT ("years") DO NOTHING;
