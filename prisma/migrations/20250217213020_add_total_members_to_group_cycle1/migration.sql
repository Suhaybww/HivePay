/*
  Warnings:

  - The values [Archived] on the enum `CycleStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `cycleConfiguration` on the `Group` table. All the data in the column will be lost.
  - You are about to drop the column `cycleConfigSnapshot` on the `GroupCycle` table. All the data in the column will be lost.
  - You are about to drop the column `paymentBreakdown` on the `GroupCycle` table. All the data in the column will be lost.
  - You are about to drop the column `payoutDetails` on the `GroupCycle` table. All the data in the column will be lost.
  - You are about to drop the column `totalMembers` on the `GroupCycle` table. All the data in the column will be lost.
  - You are about to drop the column `groupCycleId` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `groupCycleId` on the `Payout` table. All the data in the column will be lost.
  - You are about to drop the column `groupCycleId` on the `Transaction` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "CycleStatus_new" AS ENUM ('Scheduled', 'Active', 'Completed', 'Partial', 'Failed');
ALTER TABLE "GroupCycle" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "GroupCycle" ALTER COLUMN "status" TYPE "CycleStatus_new" USING ("status"::text::"CycleStatus_new");
ALTER TYPE "CycleStatus" RENAME TO "CycleStatus_old";
ALTER TYPE "CycleStatus_new" RENAME TO "CycleStatus";
DROP TYPE "CycleStatus_old";
ALTER TABLE "GroupCycle" ALTER COLUMN "status" SET DEFAULT 'Completed';
COMMIT;

-- DropIndex
DROP INDEX "Group_cyclesCompleted_idx";

-- DropIndex
DROP INDEX "Group_totalGroupCyclesCompleted_idx";

-- DropIndex
DROP INDEX "GroupCycle_cycleNumber_idx";

-- DropIndex
DROP INDEX "GroupCycle_status_idx";

-- DropIndex
DROP INDEX "Payment_groupCycleId_idx";

-- DropIndex
DROP INDEX "Payout_groupCycleId_idx";

-- DropIndex
DROP INDEX "Transaction_groupCycleId_idx";

-- AlterTable
ALTER TABLE "Group" DROP COLUMN "cycleConfiguration",
ADD COLUMN     "nextMemberPayoutOrder" INTEGER;

-- AlterTable
ALTER TABLE "GroupCycle" DROP COLUMN "cycleConfigSnapshot",
DROP COLUMN "paymentBreakdown",
DROP COLUMN "payoutDetails",
DROP COLUMN "totalMembers",
ALTER COLUMN "endDate" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "groupCycleId",
ADD COLUMN     "groupCycleNumber" INTEGER;

-- AlterTable
ALTER TABLE "Payout" DROP COLUMN "groupCycleId";

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "groupCycleId",
ALTER COLUMN "updatedAt" DROP DEFAULT;
