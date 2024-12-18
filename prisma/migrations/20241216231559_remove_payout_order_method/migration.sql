/*
  Warnings:

  - You are about to drop the column `payoutOrderMethod` on the `Group` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Group" DROP COLUMN "payoutOrderMethod";

-- DropEnum
DROP TYPE "PayoutOrderMethod";
