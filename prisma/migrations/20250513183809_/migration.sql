/*
  Warnings:

  - You are about to drop the column `currentPrice` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `lastPrice` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the `Ticket` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_eventId_fkey";

-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_ownerId_fkey";

-- AlterTable
ALTER TABLE "Event" DROP COLUMN "currentPrice",
DROP COLUMN "lastPrice";

-- DropTable
DROP TABLE "Ticket";
