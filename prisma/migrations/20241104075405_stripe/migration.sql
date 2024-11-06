-- AlterTable
ALTER TABLE "User" ADD COLUMN     "stripe_current_period_end" TIMESTAMP(3),
ADD COLUMN     "stripe_price_id" TEXT;
