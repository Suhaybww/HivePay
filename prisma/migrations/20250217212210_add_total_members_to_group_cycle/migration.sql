/*
  Warnings:

  - You are about to drop the column `nextMemberPayoutOrder` on the `Group` table. All the data in the column will be lost.
  - You are about to drop the column `groupCycleNumber` on the `Payment` table. All the data in the column will be lost.
  - Added the required column `cycleConfigSnapshot` to the `GroupCycle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `paymentBreakdown` to the `GroupCycle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalMembers` to the `GroupCycle` table without a default value. This is not possible if the table is not empty.
  - Made the column `endDate` on table `GroupCycle` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
ALTER TYPE "CycleStatus" ADD VALUE 'Archived';

-- AlterTable
ALTER TABLE "Group" DROP COLUMN "nextMemberPayoutOrder",
ADD COLUMN     "cycleConfiguration" JSONB;

-- AlterTable
ALTER TABLE "GroupCycle" ADD COLUMN     "cycleConfigSnapshot" JSONB NOT NULL,
ADD COLUMN     "paymentBreakdown" JSONB NOT NULL,
ADD COLUMN     "payoutDetails" JSONB,
ADD COLUMN     "totalMembers" INTEGER NOT NULL,
ALTER COLUMN "endDate" SET NOT NULL;

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "groupCycleNumber",
ADD COLUMN     "groupCycleId" TEXT;

-- AlterTable
ALTER TABLE "Payout" ADD COLUMN     "groupCycleId" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "groupCycleId" TEXT,
ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Group_cyclesCompleted_idx" ON "Group"("cyclesCompleted");

-- CreateIndex
CREATE INDEX "Group_totalGroupCyclesCompleted_idx" ON "Group"("totalGroupCyclesCompleted");

-- CreateIndex
CREATE INDEX "GroupCycle_cycleNumber_idx" ON "GroupCycle"("cycleNumber");

-- CreateIndex
CREATE INDEX "GroupCycle_status_idx" ON "GroupCycle"("status");

-- CreateIndex
CREATE INDEX "Payment_groupCycleId_idx" ON "Payment"("groupCycleId");

-- CreateIndex
CREATE INDEX "Payout_groupCycleId_idx" ON "Payout"("groupCycleId");

-- CreateIndex
CREATE INDEX "Transaction_groupCycleId_idx" ON "Transaction"("groupCycleId");
