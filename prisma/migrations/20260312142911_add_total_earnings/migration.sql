-- AlterTable
ALTER TABLE "Story" ADD COLUMN     "totalEarnings" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "metadata" TEXT;
