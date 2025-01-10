/*
  Warnings:

  - You are about to drop the `GroupFutureCycle` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "futureCyclesJson" JSONB;

-- DropTable
DROP TABLE "GroupFutureCycle";

-- DropEnum
DROP TYPE "CycleType";
