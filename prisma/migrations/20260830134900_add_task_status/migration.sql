-- CreateEnum
CREATE TYPE "Status" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'ON_HOLD', 'DONE');

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "status" "Status" NOT NULL DEFAULT 'NOT_STARTED';
