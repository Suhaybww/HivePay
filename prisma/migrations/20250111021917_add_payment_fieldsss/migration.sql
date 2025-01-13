/*
  Warnings:

  - You are about to drop the column `updateGroupPaymentStatstotalDebitedAmount` on the `Group` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Group" DROP COLUMN "updateGroupPaymentStatstotalDebitedAmount",
ADD COLUMN     "totalDebitedAmount" DECIMAL(65,30) DEFAULT 0;
