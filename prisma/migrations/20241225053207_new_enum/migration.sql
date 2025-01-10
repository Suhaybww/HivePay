-- CreateEnum
CREATE TYPE "PauseReason" AS ENUM ('PAYMENT_FAILURES', 'REFUND_ALL', 'INACTIVE_SUBSCRIPTION', 'OTHER');

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "pauseReason" "PauseReason";
