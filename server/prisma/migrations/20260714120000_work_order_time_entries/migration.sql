-- CreateTable
CREATE TABLE "WorkOrderTimeEntry" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "workDate" DATE NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrderTimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkOrderTimeEntry_workOrderId_idx" ON "WorkOrderTimeEntry"("workOrderId");

-- CreateIndex
CREATE INDEX "WorkOrderTimeEntry_userId_idx" ON "WorkOrderTimeEntry"("userId");

-- CreateIndex
CREATE INDEX "WorkOrderTimeEntry_workDate_idx" ON "WorkOrderTimeEntry"("workDate");

-- AddForeignKey
ALTER TABLE "WorkOrderTimeEntry" ADD CONSTRAINT "WorkOrderTimeEntry_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderTimeEntry" ADD CONSTRAINT "WorkOrderTimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
