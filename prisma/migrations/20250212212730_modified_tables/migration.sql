/*
  Warnings:

  - Added the required column `memberCycleNumber` to the `GroupCycle` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "currentMemberCycleNumber" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "GroupCycle" ADD COLUMN     "memberCycleNumber" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "groupCycleNumber" INTEGER,
ADD COLUMN     "memberCycleNumber" INTEGER;
