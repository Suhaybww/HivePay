/*
  Warnings:

  - The `becsSetupStatus` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "BECSSetupStatus" AS ENUM ('Pending', 'Completed', 'Failed');

-- AlterTable
ALTER TABLE "User" DROP COLUMN "becsSetupStatus",
ADD COLUMN     "becsSetupStatus" "BECSSetupStatus" NOT NULL DEFAULT 'Pending';
