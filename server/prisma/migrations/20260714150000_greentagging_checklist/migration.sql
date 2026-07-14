-- CreateTable
CREATE TABLE "GreenTagChecklistItem" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GreenTagChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GreenTagChecklistItem_assignmentId_idx" ON "GreenTagChecklistItem"("assignmentId");

-- AddForeignKey
ALTER TABLE "GreenTagChecklistItem" ADD CONSTRAINT "GreenTagChecklistItem_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "GreenTagAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GreenTagChecklistItem" ADD CONSTRAINT "GreenTagChecklistItem_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
