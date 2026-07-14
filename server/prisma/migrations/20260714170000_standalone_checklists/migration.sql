-- CreateTable
CREATE TABLE "StandaloneChecklist" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StandaloneChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StandaloneChecklistItem" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StandaloneChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StandaloneChecklistPhoto" (
    "id" TEXT NOT NULL,
    "checklistItemId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StandaloneChecklistPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StandaloneChecklist_createdById_idx" ON "StandaloneChecklist"("createdById");

-- CreateIndex
CREATE INDEX "StandaloneChecklist_updatedAt_idx" ON "StandaloneChecklist"("updatedAt");

-- CreateIndex
CREATE INDEX "StandaloneChecklistItem_checklistId_idx" ON "StandaloneChecklistItem"("checklistId");

-- CreateIndex
CREATE INDEX "StandaloneChecklistPhoto_checklistItemId_idx" ON "StandaloneChecklistPhoto"("checklistItemId");

-- CreateIndex
CREATE INDEX "StandaloneChecklistPhoto_uploadedById_idx" ON "StandaloneChecklistPhoto"("uploadedById");

-- AddForeignKey
ALTER TABLE "StandaloneChecklist" ADD CONSTRAINT "StandaloneChecklist_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandaloneChecklistItem" ADD CONSTRAINT "StandaloneChecklistItem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "StandaloneChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandaloneChecklistItem" ADD CONSTRAINT "StandaloneChecklistItem_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandaloneChecklistPhoto" ADD CONSTRAINT "StandaloneChecklistPhoto_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "StandaloneChecklistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandaloneChecklistPhoto" ADD CONSTRAINT "StandaloneChecklistPhoto_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
