-- Step 1: Add new columns as nullable first
ALTER TABLE "Transaction"
  ADD COLUMN "userId"     TEXT,
  ADD COLUMN "chapterId"  TEXT,
  ADD COLUMN "donationId" TEXT,
  ADD COLUMN "orderCode"  INTEGER;

-- Step 2: Backfill userId from Wallet for existing rows
UPDATE "Transaction" t
SET "userId" = w."userId"
FROM "Wallet" w
WHERE t."walletId" = w.id;

-- Step 3: Make userId NOT NULL now that all rows are filled
ALTER TABLE "Transaction" ALTER COLUMN "userId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Transaction_userId_idx"     ON "Transaction"("userId");
CREATE INDEX "Transaction_orderCode_idx"  ON "Transaction"("orderCode");
CREATE INDEX "Transaction_donationId_idx" ON "Transaction"("donationId");
CREATE INDEX "Transaction_chapterId_idx"  ON "Transaction"("chapterId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_donationId_fkey"
  FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_chapterId_fkey"
  FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
