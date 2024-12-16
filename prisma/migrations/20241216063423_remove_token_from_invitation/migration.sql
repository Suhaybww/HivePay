/*
  Warnings:

  - You are about to drop the column `token` on the `Invitation` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Invitation_token_key";

-- AlterTable
ALTER TABLE "Invitation" DROP COLUMN "token";
