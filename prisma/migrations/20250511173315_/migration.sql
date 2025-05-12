/*
  Warnings:

  - Added the required column `privateKey` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `validated` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "privateKey" TEXT NOT NULL,
ADD COLUMN     "validated" BOOLEAN NOT NULL;
