-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "payoutOrder" INTEGER;

-- AlterTable
ALTER TABLE "Payout" ALTER COLUMN "payoutOrder" DROP NOT NULL;
