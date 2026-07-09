-- CreateTable
CREATE TABLE "SopDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT,
    "documentUrl" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SopDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SopDocument_department_idx" ON "SopDocument"("department");

-- CreateIndex
CREATE INDEX "SopDocument_title_idx" ON "SopDocument"("title");
