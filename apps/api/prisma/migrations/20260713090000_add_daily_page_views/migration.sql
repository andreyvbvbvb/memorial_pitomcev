CREATE TABLE "PageViewDaily" (
  "id" TEXT NOT NULL,
  "day" TEXT NOT NULL,
  "page" TEXT NOT NULL,
  "views" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PageViewDaily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PageViewDaily_day_page_key" ON "PageViewDaily"("day", "page");
CREATE INDEX "PageViewDaily_day_idx" ON "PageViewDaily"("day");
