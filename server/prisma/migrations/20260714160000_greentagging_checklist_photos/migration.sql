-- CreateTable
CREATE TABLE "GreenTagChecklistPhoto" (
    "id" TEXT NOT NULL,
    "checklistItemId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GreenTagChecklistPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GreenTagChecklistPhoto_checklistItemId_idx" ON "GreenTagChecklistPhoto"("checklistItemId");

-- CreateIndex
CREATE INDEX "GreenTagChecklistPhoto_uploadedById_idx" ON "GreenTagChecklistPhoto"("uploadedById");

-- AddForeignKey
ALTER TABLE "GreenTagChecklistPhoto" ADD CONSTRAINT "GreenTagChecklistPhoto_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "GreenTagChecklistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GreenTagChecklistPhoto" ADD CONSTRAINT "GreenTagChecklistPhoto_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
