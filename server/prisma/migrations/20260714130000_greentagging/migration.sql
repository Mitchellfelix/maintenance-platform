-- CreateEnum
CREATE TYPE "GreenTagStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "GreenTagAssignment" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "status" "GreenTagStatus" NOT NULL DEFAULT 'OPEN',
    "assetId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GreenTagAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GreenTagCase" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "directions" TEXT,
    "status" "GreenTagStatus" NOT NULL DEFAULT 'OPEN',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GreenTagCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GreenTagAssignment_assetId_idx" ON "GreenTagAssignment"("assetId");

-- CreateIndex
CREATE INDEX "GreenTagAssignment_status_idx" ON "GreenTagAssignment"("status");

-- CreateIndex
CREATE INDEX "GreenTagAssignment_assigneeId_idx" ON "GreenTagAssignment"("assigneeId");

-- CreateIndex
CREATE INDEX "GreenTagCase_assignmentId_idx" ON "GreenTagCase"("assignmentId");

-- CreateIndex
CREATE INDEX "GreenTagCase_status_idx" ON "GreenTagCase"("status");

-- AddForeignKey
ALTER TABLE "GreenTagAssignment" ADD CONSTRAINT "GreenTagAssignment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GreenTagAssignment" ADD CONSTRAINT "GreenTagAssignment_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GreenTagCase" ADD CONSTRAINT "GreenTagCase_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "GreenTagAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
