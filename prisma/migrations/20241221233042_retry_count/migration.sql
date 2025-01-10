-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0;
